import os

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template import Template, Context
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from django.utils.timezone import localtime
import logging

logger = logging.getLogger(__name__)


REGISTRATION_STATE_FILENAME = "registration_closed_state.txt"


def _get_state_file_path() -> str:
    """Return absolute path to the global registration state file.

    Uses the project directory so the file sits alongside other project-level state files
    like maintenance_mode_state.txt.
    """
    project_dir = getattr(settings, "PROJECT_DIR", settings.BASE_DIR)
    return os.path.join(project_dir, REGISTRATION_STATE_FILENAME)


def get_global_registration_closed() -> bool:
    """Read the registration closed flag from a simple text file ("0"/"1").

    Missing file defaults to open (False).
    """
    path = _get_state_file_path()
    try:
        with open(path, "r") as f:
            return f.read().strip() == "1"
    except FileNotFoundError:
        return False


def set_global_registration_closed(closed: bool) -> None:
    """Persist the registration closed flag to a simple text file as "0"/"1"."""
    path = _get_state_file_path()
    # Ensure directory exists; PROJECT_DIR should already exist, but be safe for tests
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write("1" if closed else "0")


def compute_lottery_draw(event, seed=None, reserved_member_slots=0):
    """Shuffle pending entries and greedily pick winners — pure computation, no side effects.

    If ``reserved_member_slots`` > 0, that many slots are filled from members
    first.  Unused reserved slots fall back to the public pool.
    """
    import random
    from oscar.core.loading import get_model
    EventParticipant = get_model("event", "EventParticipant")

    pending = list(
        EventParticipant.objects.select_related("participant")
        .filter(event=event, is_lottery_pending=True, is_cancelled=False)
        .order_by("id")
    )
    if seed is None:
        seed = random.randint(0, 2**31 - 1)

    if not pending:
        return {"seed": seed, "winners": [], "losers": [], "entry_ids": []}

    rng = random.Random(seed)
    rng.shuffle(pending)

    # Stable sort: newcomers first, returning participants last
    if event.collect_prior_attendance:
        def _attended(ep):
            ej = ep.extra_json
            if isinstance(ej, list):
                ej = ej[0] if ej else {}
            return bool(ej and isinstance(ej, dict) and ej.get("attended_before"))
        pending.sort(key=_attended)

    capacity = event.max_participants
    taken = event.participant_count
    remaining = (capacity - taken) if capacity is not None else None

    reserved_member_slots = max(int(reserved_member_slots or 0), 0)

    winners = []
    losers = []

    if reserved_member_slots and remaining is not None:
        members = [ep for ep in pending if ep.is_member]
        non_members = [ep for ep in pending if not ep.is_member]

        member_remaining = reserved_member_slots
        member_winners = []
        member_leftover = []
        for ep in members:
            qty = ep.participant.quantity
            if qty <= member_remaining:
                member_winners.append(ep)
                member_remaining -= qty
            else:
                member_leftover.append(ep)

        for ep in member_winners:
            winners.append(ep)
            remaining -= ep.participant.quantity

        # Remaining capacity open to everyone (leftover members + non-members)
        public_pool = member_leftover + non_members
        for ep in public_pool:
            qty = ep.participant.quantity
            if qty <= remaining:
                winners.append(ep)
                remaining -= qty
            else:
                losers.append(ep)
    else:
        for ep in pending:
            qty = ep.participant.quantity
            if remaining is None or qty <= remaining:
                winners.append(ep)
                if remaining is not None:
                    remaining -= qty
            else:
                losers.append(ep)

    def _serialise(ep):
        p = ep.participant
        d = {
            "ep_id": ep.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "email": p.email,
            "phone_number": p.phone_number or "",
            "quantity": p.quantity,
            "registered_at": ep.registered_at,
            "is_member": ep.is_member,
        }
        if event.collect_prior_attendance:
            ej = ep.extra_json
            if isinstance(ej, list):
                ej = ej[0] if ej else {}
            d["attended_before"] = bool(ej and isinstance(ej, dict) and ej.get("attended_before"))
        return d

    return {
        "seed": seed,
        "winners": [_serialise(ep) for ep in winners],
        "losers": [_serialise(ep) for ep in losers],
        "entry_ids": sorted(ep.id for ep in pending),
    }


def run_lottery_draw(event, seed=None, reserved_member_slots=0):
    """
    Randomly select winners from the pool of lottery-pending entries for ``event``.

    If ``seed`` is provided the draw is deterministic (used to replay a preview).
    Sets event.lottery_drawn_at and sends a result email per entry.

    Returns a dict with counts: {"winners": N, "losers": M, "entries": total}.
    """
    from oscar.core.loading import get_model
    EventParticipant = get_model("event", "EventParticipant")

    result = compute_lottery_draw(event, seed=seed, reserved_member_slots=reserved_member_slots)
    winner_ids = {w["ep_id"] for w in result["winners"]}
    loser_ids = {l["ep_id"] for l in result["losers"]}

    if not winner_ids and not loser_ids:
        if not event.lottery_drawn_at:
            from django.utils import timezone
            event.lottery_drawn_at = timezone.now()
            event.save(update_fields=["lottery_drawn_at"])
        return {"winners": 0, "losers": 0, "entries": 0}

    all_ids = winner_ids | loser_ids
    eps = {ep.id: ep for ep in EventParticipant.objects.select_related("participant").filter(id__in=all_ids)}

    for eid in winner_ids:
        ep = eps[eid]
        ep.is_lottery_pending = False
        ep.is_confirmed = True
        ep.save(update_fields=["is_lottery_pending", "is_confirmed"])

    for eid in loser_ids:
        ep = eps[eid]
        ep.is_lottery_pending = False
        ep.is_lottery_lost = True
        ep.save(update_fields=["is_lottery_pending", "is_lottery_lost"])

    from django.utils import timezone
    event.lottery_drawn_at = timezone.now()
    event.save(update_fields=["lottery_drawn_at"])

    for eid in winner_ids:
        send_lottery_won_email(event, eps[eid].participant)
    for eid in loser_ids:
        send_lottery_lost_email(event, eps[eid].participant)

    return {"winners": len(winner_ids), "losers": len(loser_ids), "entries": len(all_ids)}


def send_lottery_entered_email(event, participant):
    """Confirm a lottery entry was received (no slot yet)."""
    from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)

    draw_when = ""
    if event.registration_end:
        try:
            draw_when = f" after sign-ups close on {localtime(event.registration_end).strftime('%B %d, %Y at %I:%M %p')}"
        except Exception:
            draw_when = ""

    subject = f"Lottery entry received – {event.title}"
    qty_line_html = f"<br>Number of spots requested: {participant.quantity}" if participant.quantity > 1 else ""
    qty_line_text = f"\nNumber of spots requested: {participant.quantity}" if participant.quantity > 1 else ""
    ec_line_html = (
        f"<br>Emergency contact: {participant.emergency_contact_name} {participant.emergency_contact_phone or ''}"
        if participant.emergency_contact_name else ""
    )
    ec_line_text = (
        f"\nEmergency contact: {participant.emergency_contact_name} {participant.emergency_contact_phone or ''}"
        if participant.emergency_contact_name else ""
    )
    html_content = f"""
<p>Hi {participant.first_name},</p>

<p>Thanks for entering the lottery for <strong>{event.title}</strong>! Your entry has been received.</p>

<p>This event uses a random draw to allocate places. We'll run the draw{draw_when} and email you with the result. No payment or further action is needed from you right now.</p>

<p><strong>Your entry details</strong><br>
Name: {participant.first_name} {participant.last_name}<br>
Email: {participant.email}<br>
Phone: {participant.phone_number or '—'}{qty_line_html}{ec_line_html}</p>

<p>If anything above looks wrong, just reply to this email and we'll fix it.</p>

<p>— Bird Society of Singapore</p>
"""
    text_content = (
        f"Hi {participant.first_name},\n\n"
        f"Thanks for entering the lottery for {event.title}! Your entry has been received.\n\n"
        f"This event uses a random draw to allocate places. We'll run the draw{draw_when} "
        f"and email you with the result.\n\n"
        f"Your entry details\n"
        f"Name: {participant.first_name} {participant.last_name}\n"
        f"Email: {participant.email}\n"
        f"Phone: {participant.phone_number or '—'}{qty_line_text}{ec_line_text}\n\n"
        f"If anything looks wrong, just reply to this email and we'll fix it.\n\n"
        f"— Bird Society of Singapore"
    )
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[participant.email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Lottery entered email sent to {participant.email} for event {event.id}")
    except Exception as exc:
        logger.error(f"Failed to send lottery entered email: {exc}")


def _lottery_email_context(event, participant):
    """Template context shared by the customisable lottery result emails."""
    return {
        "first_name": participant.first_name,
        "last_name": participant.last_name,
        "email": participant.email,
        "phone_number": participant.phone_number,
        "quantity": participant.quantity,
        "event_title": event.title,
        "event_date": localtime(event.start_date).strftime("%B %d, %Y at %I:%M %p") if event.start_date else "",
        "event_location": event.location or "",
        "event": event,
        "participant": participant,
    }


def send_lottery_won_email(event, participant, to_email=None):
    """Tell a participant they won a spot in the lottery draw.

    The subject and HTML body can be customised per-event via
    ``event.lottery_won_email_subject`` / ``event.lottery_won_email_template``;
    when blank the built-in defaults below are used.

    Pass ``to_email`` to redirect the message to a test address instead of the
    participant's own email (used by the "send test emails" feature). In that
    case the follow-up confirmation email is skipped so no real recipient is
    contacted.
    """
    from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)
    recipient = to_email or participant.email

    ctx = Context(_lottery_email_context(event, participant))
    custom_subject = (event.lottery_won_email_subject or "").strip()
    custom_body = (event.lottery_won_email_template or "").strip()

    if custom_subject:
        subject = Template(custom_subject).render(ctx)
    else:
        subject = f"Great news — you got a spot at {event.title} [please reply to confirm]"

    if custom_body:
        html_content = Template(custom_body).render(ctx)
        text_content = ""
    else:
        slot_word = "spot" if participant.quantity == 1 else "spots"
        html_content = f"""
<p>Hi {participant.first_name},</p>

<p>Good news! You've been selected in the lottery for <strong>{event.title}</strong>.</p>

<p><b>This event is in high demand, so to confirm your place, please reply to this email within the next 48 hours.</b> If we don't hear back from you, your {slot_word} will be released to someone else on the waitlist.</p>

<p>We look forward to seeing you there!</p>

<p>— Bird Society of Singapore</p>
"""
        text_content = (
            f"Hi {participant.first_name},\n\n"
            f"Good news! You've been selected in the lottery for {event.title}. "
            f"This event is in high demand, so to confirm your place, please reply to this email within the next 48 hours. "
            f"We look forward to seeing you there!\n\n"
            f"— Bird Society of Singapore"
        )
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        # Fire the regular confirmed email too if a template is configured.
        # Skipped for test sends so we never contact a real participant.
        if not to_email and event.confirmed_email_template and event.confirmed_email_template.strip():
            send_free_registration_confirmation_email(event, participant)
        logger.info(f"Lottery won email sent to {recipient} for event {event.id}")
    except Exception as exc:
        logger.error(f"Failed to send lottery won email: {exc}")


def send_lottery_lost_email(event, participant, to_email=None):
    """Tell a participant they weren't selected in the lottery draw.

    The subject and HTML body can be customised per-event via
    ``event.lottery_lost_email_subject`` / ``event.lottery_lost_email_template``;
    when blank the built-in defaults below are used.

    Pass ``to_email`` to redirect the message to a test address instead of the
    participant's own email (used by the "send test emails" feature).
    """
    from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)
    recipient = to_email or participant.email

    ctx = Context(_lottery_email_context(event, participant))
    custom_subject = (event.lottery_lost_email_subject or "").strip()
    custom_body = (event.lottery_lost_email_template or "").strip()

    if custom_subject:
        subject = Template(custom_subject).render(ctx)
    else:
        subject = f"Lottery result – {event.title}"

    if custom_body:
        html_content = Template(custom_body).render(ctx)
        text_content = ""
    else:
        html_content = f"""
<p>Hi {participant.first_name},</p>

<p>Thanks for entering the lottery for <strong>{event.title}</strong>. Unfortunately,
you weren't selected in this draw. We had more entries than available spots.</p>

<p>We hope to see you at a future event! Keep an eye on our events page for upcoming opportunities.</p>

<p>— Bird Society of Singapore</p>
"""
        text_content = (
            f"Hi {participant.first_name},\n\n"
            f"Thanks for entering the lottery for {event.title}. Unfortunately, you weren't "
            f"selected in this draw. We had more entries than available spots.\n\n"
            f"We hope to see you at a future event!\n\n"
            f"— Bird Society of Singapore"
        )
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Lottery lost email sent to {recipient} for event {event.id}")
    except Exception as exc:
        logger.error(f"Failed to send lottery lost email: {exc}")


def promote_from_waitlist(event):
    """
    Greedy waitlist promotion: walk the waitlist in join order and promote anyone
    whose full quantity fits in the currently available slots. Stops when no slots
    remain or no remaining entry fits.

    For free events the participant is auto-confirmed.
    For paid events an EventRegistration is created and a payment-request email sent.
    """
    from oscar.core.loading import get_model
    EventParticipant = get_model("event", "EventParticipant")
    EventRegistration = get_model("event", "EventRegistration")

    if event.max_participants is None:
        return

    available = event.max_participants - event.participant_count - event.pending_count
    if available <= 0:
        return

    waitlisted = (
        EventParticipant.objects.select_related("participant")
        .filter(event=event, is_waitlisted=True, is_cancelled=False)
        .order_by("registered_at")
    )

    is_paid_event = event.price_incl_tax > 0

    for ep in waitlisted:
        qty = ep.participant.quantity
        if qty > available:
            continue

        p = ep.participant
        ep.is_waitlisted = False

        if not is_paid_event:
            ep.is_confirmed = True
            ep.save(update_fields=["is_waitlisted", "is_confirmed"])
            send_waitlist_promoted_free_email(event, p)
        else:
            ep.save(update_fields=["is_waitlisted"])
            from decimal import Decimal as _D
            unit_price = event.get_unit_price_from_tiers({})
            amount = unit_price * _D(str(qty))
            reg = EventRegistration.objects.create(
                event=event,
                participant=p,
                amount=amount,
                currency=event.currency,
                reference="",
                emergency_contact_name=p.emergency_contact_name,
                emergency_contact_phone=p.emergency_contact_phone,
            )
            reg.reference = f"EV-{event.id}-{reg.id}"
            reg.save(update_fields=["reference"])
            send_waitlist_promoted_paid_email(event, p, reg)

        available -= qty
        if available <= 0:
            break


def send_waitlist_joined_email(event, participant, position):
    """Notify a participant that they have joined the waitlist."""
    from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)

    subject = f"You're on the waitlist – {event.title}"
    slot_word = "spot" if participant.quantity == 1 else "spots"
    html_content = f"""
<p>Hi {participant.first_name},</p>

<p>Thanks for your interest in <strong>{event.title}</strong>! Unfortunately all spots are currently
taken, but you've been added to the waitlist at <strong>position {position}</strong>.</p>

<p>We'll email you if a {slot_word} become{'s' if participant.quantity == 1 else ''} available. No action is needed from you right now.</p>

<p>— Bird Society of Singapore</p>
"""
    text_content = (
        f"Hi {participant.first_name},\n\n"
        f"Thanks for your interest in {event.title}! You've been added to the waitlist "
        f"at position {position}.\n\n"
        f"We'll email you if a {slot_word} become{'s' if participant.quantity == 1 else ''} available.\n\n"
        f"— Bird Society of Singapore"
    )
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[participant.email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Waitlist joined email sent to {participant.email} for event {event.id} (position {position})")
    except Exception as exc:
        logger.error(f"Failed to send waitlist joined email: {exc}")


def send_waitlist_promoted_free_email(event, participant):
    """Notify a participant that they've been promoted from the waitlist (free event)."""
    from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)

    subject = f"Great news — you're confirmed for {event.title}!"
    slot_word = "slot" if participant.quantity == 1 else "slots"
    html_content = f"""
<p>Hi {participant.first_name},</p>

<p>Good news! A {slot_word} opened up for <strong>{event.title}</strong> and you've been
moved off the waitlist. Your registration is now <strong>confirmed</strong>.</p>

<p>We look forward to seeing you there!</p>

<p>— Bird Society of Singapore</p>
"""
    text_content = (
        f"Hi {participant.first_name},\n\n"
        f"Good news! A {slot_word} opened up for {event.title} and you've been moved off "
        f"the waitlist. Your registration is now confirmed.\n\n"
        f"We look forward to seeing you there!\n\n"
        f"— Bird Society of Singapore"
    )
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[participant.email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Waitlist promoted (free) email sent to {participant.email} for event {event.id}")
    except Exception as exc:
        logger.error(f"Failed to send waitlist promoted (free) email: {exc}")


def send_waitlist_promoted_paid_email(event, participant, registration):
    """Notify a participant that a spot opened up and they need to pay to confirm."""
    from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)

    subject = f"A spot opened up — complete payment for {event.title}"
    total = registration.amount + (registration.donation_amount or 0)
    html_content = f"""
<p>Hi {participant.first_name},</p>

<p>Good news! A spot opened up for <strong>{event.title}</strong> and you're next on the waitlist.</p>

<p>To confirm your place, please complete payment of <strong>{event.currency} {total:.2f}</strong>
using reference <strong>{registration.reference}</strong>.</p>

<p>Please note: if payment is not received within 15 minutes your spot will be released to the
next person on the waitlist.</p>

<p>— Bird Society of Singapore</p>
"""
    text_content = (
        f"Hi {participant.first_name},\n\n"
        f"Good news! A spot opened up for {event.title} and you're next on the waitlist.\n\n"
        f"To confirm your place, please complete payment of {event.currency} {total:.2f} "
        f"using reference {registration.reference}.\n\n"
        f"Please note: if payment is not received within 15 minutes your spot will be released "
        f"to the next person on the waitlist.\n\n"
        f"— Bird Society of Singapore"
    )
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[participant.email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Waitlist promoted (paid) email sent to {participant.email} for event {event.id}")
    except Exception as exc:
        logger.error(f"Failed to send waitlist promoted (paid) email: {exc}")


def send_slot_released_email(registration=None, group=None):
    """
    Send a "slot released" notification email when payment wasn't received in time.
    Exactly one of `registration` (individual) or `group` must be provided.
    """
    from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)

    if registration is not None:
        event = registration.event
        participant = registration.participant
        to_email = participant.email
        first_name = participant.first_name
        quantity = participant.quantity
        subject = f"Slot released – {event.title}"
    elif group is not None:
        event = group.event
        to_email = group.payer_email
        first_name = group.payer_name.split()[0] if group.payer_name else "there"
        quantity = sum(r.participant.quantity for r in group.registrations.select_related("participant").all())
        subject = f"Slot released – {event.title}"
    else:
        return

    slot_word = "slot" if quantity == 1 else "slots"
    html_content = f"""
<p>Hi {first_name},</p>

<p>We haven't received payment for <strong>{event.title}</strong> within 15 minutes of your registration.
Due to high demand, we've had to release your {slot_word}.</p>

<p>If you'd still like to attend, please <a href="https://shop.birdsociety.sg/events/{event.id}">register again</a>
while spots are available.</p>

<p>Sorry for the inconvenience — we hope to see you there!</p>

<p>— Bird Society of Singapore</p>
"""
    text_content = (
        f"Hi {first_name},\n\n"
        f"We haven't received payment for {event.title} within 15 minutes of your registration. "
        f"Due to high demand, we've had to release your {slot_word}.\n\n"
        f"If you'd still like to attend, please register again at https://shop.birdsociety.sg/events/{event.id} "
        f"while spots are available.\n\n"
        f"Sorry for the inconvenience — we hope to see you there!\n\n"
        f"— Bird Society of Singapore"
    )

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[to_email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(
            f"Slot released email sent to {to_email} "
            f"({'reg ' + str(registration.id) if registration else 'group ' + str(group.id)})"
        )
    except Exception as exc:
        logger.error(f"Failed to send slot released email: {exc}")


def send_payment_confirmation_email(event_registration):
    """
    Send payment confirmation email for an event registration.
    Uses the event's confirmed_email_template if available.
    Only sends to participants marked as main contact.
    """
    event = event_registration.event
    participant = event_registration.participant

    # Check if this participant is marked as main contact
    try:
        event_participant = event.eventparticipant_set.get(participant=participant)
        if not event_participant.is_main_contact:
            logger.info(
                f"Skipping email for participant {participant.email} - not marked as main contact"
            )
            return
    except event.eventparticipant_set.model.DoesNotExist:
        logger.warning(
            f"EventParticipant not found for registration {event_registration.id}"
        )
        return

    # Skip if no email template is configured
    if not event.confirmed_email_template or not event.confirmed_email_template.strip():
        logger.info(
            f"No email template configured for event {event.id}, skipping confirmation email"
        )
        return

    # Prepare participant details based on registration type
    if event_registration.group:
        # This is a group registration
        group = event_registration.group
        total_participants = sum(
            reg.participant.quantity for reg in group.registrations.all()
        )
        participant_details = mark_safe(f"""<strong>Participant details</strong><br>
Name of the main contact: {group.payer_name}<br>
Phone number of the main contact: {group.payer_phone}<br>
Number of participants in this order: {total_participants}<br>""")
    else:
        # This is an individual registration
        participant_details = mark_safe(f"""<strong>Participant details</strong><br>
Name: {participant.first_name} {participant.last_name}<br>
Phone number: {participant.phone_number}<br>""")

    # Prepare template context
    context_data = {
        "first_name": participant.first_name,
        "last_name": participant.last_name,
        "email": participant.email,
        "phone_number": participant.phone_number,
        "quantity": participant.quantity,
        "event_title": event.title,
        "event_date": localtime(event.start_date).strftime("%B %d, %Y at %I:%M %p")
        if event.start_date
        else "",
        "event_location": event.location,
        "amount": str(
            event_registration.amount + (event_registration.donation_amount or 0)
        ),
        "currency": event_registration.currency,
        "registration_reference": event_registration.reference,
        "participant_details": participant_details,
        "event": event,
        "participant": participant,
        "registration": event_registration,
    }

    try:
        # Render the email template
        template = Template(event.confirmed_email_template)
        context = Context(context_data)
        html_content = template.render(context)

        # Create email subject
        subject = f"Payment Confirmed - {event.title}"

        # Prepare email
        from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
        reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)

        email = EmailMultiAlternatives(
            subject=subject,
            body="",  # We'll use HTML content only
            from_email=from_email,
            to=[participant.email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )

        # Attach HTML content
        email.attach_alternative(html_content, "text/html")

        # Send email
        email.send()
        logger.info(
            f"Payment confirmation email sent to {participant.email} for event registration {event_registration.id}"
        )

    except Exception as e:
        logger.error(
            f"Failed to send payment confirmation email for registration {event_registration.id}: {str(e)}"
        )
        # Don't raise the exception to avoid blocking the payment verification process


def send_free_registration_confirmation_email(event, participant):
    """
    Send a registration confirmation email for a free-event registration.
    Uses the same confirmed_email_template as paid events.
    """
    if not event.confirmed_email_template or not event.confirmed_email_template.strip():
        logger.info(f"No email template configured for event {event.id}, skipping free registration email")
        return

    participant_details = mark_safe(
        f"<strong>Participant details</strong><br>"
        f"Name: {participant.first_name} {participant.last_name}<br>"
        f"Phone number: {participant.phone_number}<br>"
    )

    context_data = {
        "first_name": participant.first_name,
        "last_name": participant.last_name,
        "email": participant.email,
        "phone_number": participant.phone_number,
        "quantity": participant.quantity,
        "event_title": event.title,
        "event_date": localtime(event.start_date).strftime("%B %d, %Y at %I:%M %p") if event.start_date else "",
        "event_location": event.location or "",
        "amount": "0.00",
        "currency": event.currency,
        "registration_reference": "",
        "participant_details": participant_details,
        "event": event,
        "participant": participant,
    }

    try:
        html_content = Template(event.confirmed_email_template).render(Context(context_data))
        from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
        reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)
        msg = EmailMultiAlternatives(
            subject=f"Registration Confirmed – {event.title}",
            body="",
            from_email=from_email,
            to=[participant.email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f"Free registration confirmation email sent to {participant.email} for event {event.id}")
    except Exception as exc:
        logger.error(f"Failed to send free registration confirmation email: {exc}")


def send_group_payment_confirmation_emails(event_registration_group):
    """
    Send a single payment confirmation email to the group payer for all registrations in the group.
    """
    group = event_registration_group
    event = group.event

    # Skip if no email template is configured
    if not event.confirmed_email_template or not event.confirmed_email_template.strip():
        logger.info(
            f"No email template configured for event {event.id}, skipping group confirmation email"
        )
        return

    # Skip if no payer email
    if not group.payer_email or not group.payer_email.strip():
        logger.warning(
            f"No payer email configured for group {group.id}, skipping group confirmation email"
        )
        return

    # Prepare participant details for all participants in the group
    participant_details = "<strong>Participant details</strong><br>"
    participant_details += f"Name of the main contact: {group.payer_name}<br>"
    participant_details += f"Phone number of the main contact: {group.payer_phone}<br>"

    # Add details for each participant
    total_quantity = group.registrations.select_related("participant").count()
    # participant_details += "<br><strong>Participants registered:</strong><br>"
    # for i, registration in enumerate(group.registrations.select_related('participant').all(), 1):
    #     participant = registration.participant
    #     total_quantity += participant.quantity
    #     quantity_text = f" (party of {participant.quantity})" if participant.quantity > 1 else ""
    #     participant_details += f"{i}. {participant.first_name} {participant.last_name}{quantity_text} - {participant.email}<br>"

    participant_details += f"Total participants: {total_quantity}"

    # Mark the participant_details as safe HTML
    participant_details = mark_safe(participant_details)

    # Prepare template context using the group payer's information
    context_data = {
        "first_name": group.payer_name.split()[0] if group.payer_name else "",
        "last_name": " ".join(group.payer_name.split()[1:])
        if group.payer_name and len(group.payer_name.split()) > 1
        else "",
        "email": group.payer_email,
        "phone_number": group.payer_phone,
        "quantity": total_quantity,
        "event_title": event.title,
        "event_date": localtime(event.start_date).strftime("%B %d, %Y at %I:%M %p")
        if event.start_date
        else "",
        "event_location": event.location,
        "amount": str(group.amount_total + (group.donation_amount or 0)),
        "currency": group.currency,
        "registration_reference": group.reference,
        "participant_details": participant_details,
        "event": event,
        "group": group,
    }

    try:
        # Render the email template
        template = Template(event.confirmed_email_template)
        context = Context(context_data)
        html_content = template.render(context)

        # Create email subject
        subject = f"Order Confirmed - {event.title}"

        # Prepare email
        from_email = getattr(settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
        reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)

        email = EmailMultiAlternatives(
            subject=subject,
            body="",  # We'll use HTML content only
            from_email=from_email,
            to=[group.payer_email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )

        # Attach HTML content
        email.attach_alternative(html_content, "text/html")

        # Send email
        email.send()
        logger.info(
            f"Group payment confirmation email sent to {group.payer_email} for group registration {group.id}"
        )

    except Exception as e:
        logger.error(
            f"Failed to send group payment confirmation email for group {group.id}: {str(e)}"
        )
        # Don't raise the exception to avoid blocking the payment verification process
