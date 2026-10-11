"""
Validation, invite and email helpers shared by the public form API and the
console form-management API.
"""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape, linebreaks

from .models import FormInvite

logger = logging.getLogger(__name__)

FRONTEND_BASE_URL = getattr(settings, "FRONTEND_BASE_URL", "https://shop.birdsociety.sg")

DEFAULT_EMAIL_SUBJECT = "How was {group}? Tell us in two minutes"
DEFAULT_EMAIL_BODY = (
    "Hi {first_name},\n\n"
    "Thank you for joining us at {event}. We'd love to hear how it went, what you "
    "enjoyed and what we could do better next time.\n\n"
    "The feedback form takes about two minutes:\n{link}\n\n"
    "This link is personal to your booking, so you can come back and change your "
    "answers at any time.\n\n"
    "Bird Society of Singapore"
)

RATING_RANGE = (1, 5)
SCALE_RANGE = (0, 10)


def clean_submission(form_obj, payload):
    """Validate ``payload`` against the form's fields. Returns (cleaned, errors)."""
    errors = {}
    cleaned = {}
    for f in form_obj.fields.all():
        raw = payload.get(f.key)
        if raw in (None, "", []):
            if f.required:
                errors[f.key] = "This field is required."
            continue

        if f.field_type in ("text", "textarea"):
            cleaned[f.key] = str(raw)
        elif f.field_type == "email":
            val = str(raw)
            if "@" not in val or "." not in val.split("@")[-1]:
                errors[f.key] = "Enter a valid email address."
            else:
                cleaned[f.key] = val
        elif f.field_type == "number":
            try:
                cleaned[f.key] = float(raw)
            except (TypeError, ValueError):
                errors[f.key] = "Enter a valid number."
        elif f.field_type in ("rating", "scale"):
            lo, hi = RATING_RANGE if f.field_type == "rating" else SCALE_RANGE
            try:
                val = int(raw)
            except (TypeError, ValueError):
                val = None
            if val is None or not lo <= val <= hi or str(raw).strip() not in (str(val), f"{val}.0"):
                errors[f.key] = f"Choose a value from {lo} to {hi}."
            else:
                cleaned[f.key] = val
        elif f.field_type == "date":
            cleaned[f.key] = str(raw)
        elif f.field_type == "checkbox":
            if isinstance(raw, bool):
                val = raw
            else:
                val = str(raw).lower() in ("1", "true", "yes", "on")
            if f.required and not val:
                errors[f.key] = "This field is required."
            else:
                cleaned[f.key] = val
        elif f.field_type == "select":
            val = str(raw)
            options = f.choices_list()
            if options and val not in options:
                errors[f.key] = "Invalid choice."
            else:
                cleaned[f.key] = val
        elif f.field_type == "multiselect":
            vals = payload.getlist(f.key) if hasattr(payload, "getlist") else raw
            if isinstance(vals, str):
                # Comma separated string fallback
                vals = [v.strip() for v in vals.split(",") if v.strip()]
            if not isinstance(vals, (list, tuple)):
                errors[f.key] = "Enter a list of values."
            else:
                options = f.choices_list()
                invalid = [v for v in vals if options and v not in options]
                if invalid:
                    errors[f.key] = "Invalid choice(s): " + ", ".join(map(str, invalid))
                else:
                    cleaned[f.key] = [str(v) for v in vals]
        else:
            cleaned[f.key] = str(raw)
    return cleaned, errors


def eligible_participants(form_obj, attended_only=False):
    """
    Bookings across the form's event group that can be invited: confirmed,
    not cancelled, off the waitlist / lottery queue, and with an email.
    """
    from apps.event.models import EventParticipant

    if not form_obj.event_group_id:
        return EventParticipant.objects.none()
    qs = (
        EventParticipant.objects.filter(
            event__group_id=form_obj.event_group_id,
            is_confirmed=True,
            is_cancelled=False,
            is_waitlisted=False,
            is_lottery_pending=False,
            is_lottery_lost=False,
        )
        .exclude(participant__email="")
        .select_related("participant", "event")
        .order_by("event__start_date", "event__title", "participant__first_name")
    )
    if attended_only:
        qs = qs.filter(attended=True)
    return qs


def ensure_invites(form_obj, attended_only=False):
    """Create an invite for every eligible booking that doesn't have one yet."""
    eps = list(eligible_participants(form_obj, attended_only))
    existing = set(form_obj.invites.values_list("event_participant_id", flat=True))
    new = [FormInvite(form=form_obj, event_participant=ep) for ep in eps if ep.id not in existing]
    FormInvite.objects.bulk_create(new, ignore_conflicts=True)
    return form_obj.invites.filter(event_participant__in=eps)


def invite_link(invite):
    return f"{FRONTEND_BASE_URL}/forms/{invite.form.slug}/{invite.token}"


def public_link(form_obj):
    return f"{FRONTEND_BASE_URL}/forms/{form_obj.slug}"


def _render(template, invite):
    ep = invite.event_participant
    form_obj = invite.form
    values = {
        "first_name": ep.participant.first_name or "there",
        "event": ep.event.title,
        "group": form_obj.event_group.name if form_obj.event_group_id else form_obj.name,
        "form": form_obj.name,
        "link": invite_link(invite),
    }
    out = template
    # str.replace rather than format() so stray braces in the copy can't break it.
    for k, v in values.items():
        out = out.replace("{" + k + "}", v)
    return out


def render_invite_email(invite):
    form_obj = invite.form
    subject = _render(form_obj.email_subject or DEFAULT_EMAIL_SUBJECT, invite)
    body = _render(form_obj.email_body or DEFAULT_EMAIL_BODY, invite)
    link = invite_link(invite)
    html = linebreaks(escape(body)).replace(
        escape(link), f'<a href="{escape(link)}">{escape(link)}</a>'
    )
    return subject, body, html


def send_invite_email(invite):
    """Send one invite email. Returns True on success and stamps ``emailed_at``."""
    subject, text, html = render_invite_email(invite)
    # Strip: a stray newline in the env var would make the From header invalid.
    from_email = (getattr(settings, "OSCAR_FROM_EMAIL", None) or settings.DEFAULT_FROM_EMAIL or "").strip()
    reply_to_email = (getattr(settings, "REPLY_TO_EMAIL", None) or "").strip()
    to = invite.event_participant.participant.email
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=from_email,
            to=[to],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        msg.attach_alternative(html, "text/html")
        msg.send()
    except Exception as exc:
        logger.error(f"Failed to send form invite {invite.id} to {to}: {exc}")
        return False
    invite.emailed_at = timezone.now()
    invite.save(update_fields=["emailed_at"])
    return True


def send_invite_batch(form_obj, attended_only=False, limit=20):
    """
    Email up to ``limit`` invites that haven't been emailed yet. The console
    calls this repeatedly until ``remaining`` hits zero, so a big send never
    has to fit inside one request and is safe to resume after an error.
    """
    with transaction.atomic():
        invites = ensure_invites(form_obj, attended_only)
    pending = invites.filter(emailed_at__isnull=True).select_related(
        "form__event_group", "event_participant__participant", "event_participant__event"
    )
    sent, failed = 0, []
    for invite in pending[:limit]:
        if send_invite_email(invite):
            sent += 1
        else:
            failed.append(invite.event_participant.participant.email)
    return {
        "sent": sent,
        "failed": failed,
        "remaining": pending.count(),
    }
