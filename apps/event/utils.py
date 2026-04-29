import os

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template import Template, Context
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
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
        "event_date": event.start_date.strftime("%B %d, %Y at %I:%M %p")
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
        "event_date": event.start_date.strftime("%B %d, %Y at %I:%M %p")
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
