"""
Console-side event management API.
All endpoints require the user to be in the 'Events' group (or be a superuser).
"""
import uuid as _uuid
from urllib.parse import urlparse
from datetime import datetime
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator, URLValidator
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from oscar.core.loading import get_model

from apps.api.permissions import IsEventsStaff
from apps.api.views.events import DYNAMIC_QUESTIONS, _inject_dynamic_questions
from apps.event.utils import get_global_registration_closed, set_global_registration_closed


def _clean_blog_url(raw):
    """Validate and normalize a blog URL. Returns (value, error).
    ``value`` is the cleaned string or ``None`` (when cleared); ``error`` is a
    string description if validation failed, else ``None``.
    """
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None, None
    if not isinstance(raw, str):
        return None, "blog_url must be a string or null"
    cleaned = raw.strip()
    try:
        URLValidator(schemes=["https"])(cleaned)
    except ValidationError:
        return None, "blog_url must be a valid https:// URL"
    host = (urlparse(cleaned).hostname or "").lower()
    if host != "singaporebirds.com" and not host.endswith(".singaporebirds.com"):
        return None, "blog_url must point to singaporebirds.com"
    return cleaned, None

def _coerce_datetime(value):
    """Coerce an incoming JSON value to a datetime (or None).

    Django's DateTimeField only converts on DB load, so assigning a raw ISO
    string from request.data leaves the string on the in-memory instance and
    breaks any code that compares the field to ``timezone.now()`` before the
    object is refetched.
    """
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        parsed = parse_datetime(value)
        if parsed is None:
            raise ValueError(f"Invalid datetime: {value!r}")
    else:
        raise ValueError(f"Invalid datetime: {value!r}")
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


OrganizedEvent = get_model("event", "OrganizedEvent")
EventImage = get_model("event", "EventImage")
Participant = get_model("event", "Participant")
EventParticipant = get_model("event", "EventParticipant")
EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")
EventGroup = get_model("event", "EventGroup")


def _serialize_event(event, include_participants=False):
    data = {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "location": event.location,
        "max_participants": event.max_participants,
        "max_qty": event.max_qty,
        "is_active": event.is_active,
        "registration_open": event.registration_open,
        "is_registration_open": event.is_registration_open,
        "registration_start": event.registration_start,
        "registration_end": event.registration_end,
        "price_incl_tax": str(event.price_incl_tax),
        "currency": event.currency,
        "json_schema": event.json_schema,
        "price_tiers": event.price_tiers,
        "validate_participant_data": event.validate_participant_data,
        "registration_required": event.registration_required,
        "confirmed_email_template": event.confirmed_email_template,
        "lottery_won_email_subject": event.lottery_won_email_subject or "",
        "lottery_won_email_template": event.lottery_won_email_template or "",
        "lottery_lost_email_subject": event.lottery_lost_email_subject or "",
        "lottery_lost_email_template": event.lottery_lost_email_template or "",
        "post_registration_message": event.post_registration_message or "",
        "tags": event.tags or [],
        "blog_url": event.blog_url,
        "image_id": event.image_id,
        "image_url": event.image.file.url if event.image else None,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "waitlist_enabled": event.waitlist_enabled,
        "waitlist_count": event.waitlist_count,
        "signup_mode": event.signup_mode,
        "is_lottery": event.is_lottery,
        "lottery_drawn_at": event.lottery_drawn_at,
        "lottery_entry_count": event.lottery_entry_count,
        "collect_prior_attendance": event.collect_prior_attendance,
        "collect_driving": event.collect_driving,
        "guide_token": str(event.guide_token),
        "group": (
            {
                "id": event.group.id,
                "name": event.group.name,
                "slug": event.group.slug,
                "checkpoint_labels": event.group.checkpoint_labels,
            }
            if event.group_id else None
        ),
        "stats": {
            "confirmed": event.participant_count,
            "pending": event.pending_count,
            "total_unique": event.unique_participant_count,
            "waitlisted": event.waitlist_count,
            "lottery_pending": event.lottery_entry_count,
        },
    }
    if include_participants:
        data["bookings"] = _serialize_bookings(event)
    return data


def _serialize_event_for_guide(event):
    """Participant list serialization for guide access — no payment details."""
    bookings = []
    for b in _serialize_bookings(event):
        bookings.append({k: v for k, v in b.items() if k != "payment"})
    return {
        "id": event.id,
        "title": event.title,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "location": event.location,
        "json_schema": event.json_schema,
        "group": (
            {"name": event.group.name, "checkpoint_labels": event.group.checkpoint_labels}
            if event.group_id else None
        ),
        "bookings": bookings,
    }


def _serialize_bookings(event):
    """
    Unified list of all EventParticipant records enriched with payment info.
    Replaces the old separate participants/registrations/groups lists.
    """
    eps = (
        EventParticipant.objects.select_related("participant")
        .filter(event=event)
        .order_by("registered_at")
    )

    # Build a map: participant_id → registration info
    reg_map = {}
    for reg in EventRegistration.objects.select_related("group", "allocation").filter(event=event):
        reg_map[reg.participant_id] = reg

    results = []
    for ep in eps:
        p = ep.participant
        reg = reg_map.get(p.id)

        payment = None
        if reg:
            payment = {
                "id": reg.id,
                "reference": reg.reference,
                "amount": str(reg.amount),
                "donation_amount": str(reg.donation_amount),
                "amount_total": str(reg.amount + reg.donation_amount),
                "currency": reg.currency,
                "status": reg.status,
                "payment_verified": reg.payment_verified,
                "payment_verified_on": reg.payment_verified_on,
                "payment_proof_url": reg.payment_proof.url if reg.payment_proof else None,
                "is_group": reg.group_id is not None,
                "group_id": reg.group_id,
                "group_reference": reg.group.reference if reg.group else None,
                "group_status": reg.group.status if reg.group else None,
                "allocation": reg.allocation.name if reg.allocation else None,
            }

        results.append({
            "ep_id": ep.id,
            "participant_id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "email": p.email,
            "phone_number": p.phone_number,
            "emergency_contact_name": p.emergency_contact_name,
            "emergency_contact_phone": p.emergency_contact_phone,
            "quantity": p.quantity,
            "registered_at": ep.registered_at,
            "is_confirmed": ep.is_confirmed,
            "is_cancelled": ep.is_cancelled,
            "is_waitlisted": ep.is_waitlisted,
            "is_lottery_pending": ep.is_lottery_pending,
            "is_lottery_lost": ep.is_lottery_lost,
            "is_main_contact": ep.is_main_contact,
            "attended": ep.attended,
            "checkpoints": ep.checkpoints or [],
            "is_member": ep.is_member,
            "notes": ep.notes,
            "extra_json": ep.extra_json,
            "payment": payment,
        })
    return results


class ConsoleEventsViewSet(ViewSet):
    permission_classes = [IsEventsStaff]

    def list(self, request):
        """List all events (including inactive/past) for management."""
        qs = OrganizedEvent.objects.select_related("image", "group").order_by("-start_date")
        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(title__icontains=q)
        return Response([_serialize_event(e) for e in qs])

    def retrieve(self, request, pk=None):
        """Get a single event with full participant data."""
        try:
            event = OrganizedEvent.objects.select_related("image").get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_event(event, include_participants=True))

    def create(self, request):
        """Create a new event."""
        data = request.data
        required = ["title", "start_date"]
        for field in required:
            if not data.get(field):
                return Response(
                    {"detail": f"{field} is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        image_id = data.get("image_id")
        image = None
        if image_id:
            try:
                image = EventImage.objects.get(id=int(image_id))
            except EventImage.DoesNotExist:
                return Response({"detail": "Image not found"}, status=status.HTTP_400_BAD_REQUEST)
        blog_url, blog_err = _clean_blog_url(data.get("blog_url"))
        if blog_err:
            return Response({"detail": blog_err}, status=status.HTTP_400_BAD_REQUEST)
        signup_mode = data.get("signup_mode") or OrganizedEvent.SIGNUP_MODE_FIRST_COME
        if signup_mode not in dict(OrganizedEvent.SIGNUP_MODE_CHOICES):
            return Response({"detail": "Invalid signup_mode"}, status=status.HTTP_400_BAD_REQUEST)
        if signup_mode == OrganizedEvent.SIGNUP_MODE_LOTTERY:
            try:
                from decimal import Decimal
                if Decimal(str(data.get("price_incl_tax", "0"))) > 0:
                    return Response(
                        {"detail": "Lottery mode is only supported for free events."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except Exception:
                pass
        try:
            start_date = _coerce_datetime(data["start_date"])
            end_date = _coerce_datetime(data.get("end_date"))
            registration_start = _coerce_datetime(data.get("registration_start"))
            registration_end = _coerce_datetime(data.get("registration_end"))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            event = OrganizedEvent.objects.create(
                title=data["title"],
                description=data.get("description", ""),
                start_date=start_date,
                end_date=end_date,
                location=data.get("location", ""),
                max_participants=data.get("max_participants") or None,
                max_qty=int(data.get("max_qty") or 5),
                is_active=bool(data.get("is_active", True)),
                registration_open=bool(data.get("registration_open", True)),
                registration_start=registration_start,
                registration_end=registration_end,
                waitlist_enabled=bool(data.get("waitlist_enabled", False)),
                signup_mode=signup_mode,
                price_incl_tax=data.get("price_incl_tax", "0"),
                currency=data.get("currency", "SGD"),
                json_schema=data.get("json_schema") or None,
                price_tiers=data.get("price_tiers") or None,
                validate_participant_data=bool(data.get("validate_participant_data", False)),
                registration_required=bool(data.get("registration_required", True)),
                confirmed_email_template=data.get("confirmed_email_template") or None,
                lottery_won_email_subject=data.get("lottery_won_email_subject") or None,
                lottery_won_email_template=data.get("lottery_won_email_template") or None,
                lottery_lost_email_subject=data.get("lottery_lost_email_subject") or None,
                lottery_lost_email_template=data.get("lottery_lost_email_template") or None,
                post_registration_message=data.get("post_registration_message") or None,
                tags=data.get("tags") or [],
                image=image,
                blog_url=blog_url,
                collect_prior_attendance=bool(data.get("collect_prior_attendance", False)),
                collect_driving=bool(data.get("collect_driving", False)),
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_serialize_event(event), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        """Update event fields (PATCH)."""
        try:
            event = OrganizedEvent.objects.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        updatable = [
            "title", "description", "start_date", "end_date", "location",
            "max_participants", "max_qty", "is_active", "registration_open",
            "registration_start", "registration_end",
            "waitlist_enabled", "signup_mode",
            "price_incl_tax", "currency", "json_schema", "price_tiers",
            "validate_participant_data", "registration_required",
            "confirmed_email_template", "post_registration_message", "tags",
            "lottery_won_email_subject", "lottery_won_email_template",
            "lottery_lost_email_subject", "lottery_lost_email_template",
            "collect_prior_attendance",
            "collect_driving",
        ]
        if "signup_mode" in data:
            if data["signup_mode"] not in dict(OrganizedEvent.SIGNUP_MODE_CHOICES):
                return Response({"detail": "Invalid signup_mode"}, status=status.HTTP_400_BAD_REQUEST)
            # Don't allow flipping signup_mode after lottery has been drawn
            if event.lottery_drawn_at is not None and data["signup_mode"] != event.signup_mode:
                return Response(
                    {"detail": "Cannot change signup mode after the lottery has been drawn."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # Enforce free-only for lottery mode
        new_mode = data.get("signup_mode", event.signup_mode)
        if new_mode == OrganizedEvent.SIGNUP_MODE_LOTTERY:
            try:
                from decimal import Decimal
                price_str = data.get("price_incl_tax", event.price_incl_tax)
                if Decimal(str(price_str)) > 0:
                    return Response(
                        {"detail": "Lottery mode is only supported for free events."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except Exception:
                pass
        datetime_fields = ("start_date", "end_date", "registration_start", "registration_end")
        for field in updatable:
            if field in data:
                val = data[field]
                if field in datetime_fields:
                    try:
                        val = _coerce_datetime(val)
                    except ValueError as exc:
                        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                elif field in ("max_participants", "json_schema", "price_tiers",
                               "confirmed_email_template", "post_registration_message",
                               "lottery_won_email_subject", "lottery_won_email_template",
                               "lottery_lost_email_subject", "lottery_lost_email_template"):
                    if val == "" or val is None:
                        val = None
                elif field == "max_qty":
                    val = int(val or 5)
                elif field == "tags":
                    val = val if isinstance(val, list) else []
                setattr(event, field, val)
        if "image_id" in data:
            raw = data["image_id"]
            if not raw:
                event.image = None
            else:
                try:
                    event.image = EventImage.objects.get(id=int(raw))
                except EventImage.DoesNotExist:
                    return Response({"detail": "Image not found"}, status=status.HTTP_400_BAD_REQUEST)
        if "blog_url" in data:
            blog_url, blog_err = _clean_blog_url(data["blog_url"])
            if blog_err:
                return Response({"detail": blog_err}, status=status.HTTP_400_BAD_REQUEST)
            event.blog_url = blog_url
        try:
            event.save()
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        event.refresh_from_db()
        return Response(_serialize_event(event))

    def destroy(self, request, pk=None):
        """Delete an event."""
        try:
            event = OrganizedEvent.objects.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="participants/(?P<ep_id>[0-9]+)/toggle-attendance")
    def toggle_attendance(self, request, pk=None, ep_id=None):
        """Toggle the attended flag for a participant."""
        try:
            ep = EventParticipant.objects.select_related("participant").get(
                id=ep_id, event_id=pk
            )
        except EventParticipant.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        ep.attended = not ep.attended
        ep.save(update_fields=["attended"])
        return Response({"ep_id": ep.id, "attended": ep.attended})

    @action(detail=True, methods=["patch"], url_path="participants/(?P<ep_id>[0-9]+)")
    def update_participant(self, request, pk=None, ep_id=None):
        """Update notes or confirmation status for an EventParticipant."""
        try:
            ep = EventParticipant.objects.get(id=ep_id, event_id=pk)
        except EventParticipant.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        data = request.data
        changed = []
        for field in ("notes", "is_confirmed", "is_cancelled", "attended", "is_member"):
            if field in data:
                setattr(ep, field, data[field])
                changed.append(field)
        if changed:
            ep.save(update_fields=changed)
        return Response({"ep_id": ep.id, "attended": ep.attended, "is_confirmed": ep.is_confirmed, "is_cancelled": ep.is_cancelled, "notes": ep.notes})

    @action(detail=True, methods=["delete"], url_path="participants/(?P<ep_id>[0-9]+)/remove")
    def remove_participant(self, request, pk=None, ep_id=None):
        """Cancel and remove a participant from an event."""
        try:
            ep = EventParticipant.objects.select_related("participant", "event").get(
                id=ep_id, event_id=pk
            )
        except EventParticipant.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        was_waitlisted = ep.is_waitlisted

        # Cancel their registration(s) if pending
        EventRegistration.objects.filter(
            event_id=pk, participant=ep.participant, status="pending"
        ).update(status="cancelled")

        # Mark the EventParticipant as cancelled
        ep.is_cancelled = True
        ep.is_confirmed = False
        ep.is_waitlisted = False
        ep.save(update_fields=["is_cancelled", "is_confirmed", "is_waitlisted"])

        # Trigger waitlist promotion if a real slot was freed (not just a waitlist removal)
        if not was_waitlisted and ep.event.waitlist_enabled:
            from apps.event.utils import promote_from_waitlist
            promote_from_waitlist(ep.event)

        return Response({"ep_id": ep.id, "is_cancelled": True})

    @action(detail=True, methods=["post"], url_path="participants/(?P<ep_id>[0-9]+)/promote-from-waitlist")
    def promote_from_waitlist(self, request, pk=None, ep_id=None):
        """Manually promote a specific participant from the waitlist."""
        try:
            ep = EventParticipant.objects.select_related("participant", "event").get(
                id=ep_id, event_id=pk
            )
        except EventParticipant.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not ep.is_waitlisted or ep.is_cancelled:
            return Response(
                {"detail": "This participant is not on the waitlist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = ep.event
        if event.max_participants is not None:
            available = event.max_participants - event.participant_count - event.pending_count
            if ep.participant.quantity > available:
                return Response(
                    {"detail": f"Not enough spots available. Only {available} spot(s) free."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        p = ep.participant
        ep.is_waitlisted = False
        is_paid_event = event.price_incl_tax > 0

        if not is_paid_event:
            ep.is_confirmed = True
            ep.save(update_fields=["is_waitlisted", "is_confirmed"])
            from apps.event.utils import send_waitlist_promoted_free_email
            send_waitlist_promoted_free_email(event, p)
        else:
            ep.save(update_fields=["is_waitlisted"])
            from decimal import Decimal as _D
            from apps.event.utils import send_waitlist_promoted_paid_email
            unit_price = event.get_unit_price_from_tiers({})
            amount = unit_price * _D(str(p.quantity))
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

        return Response({"ep_id": ep.id, "is_waitlisted": False, "is_confirmed": ep.is_confirmed})

    @action(detail=True, methods=["post"], url_path="participants/(?P<ep_id>[0-9]+)/promote-from-lottery")
    def promote_from_lottery(self, request, pk=None, ep_id=None):
        """Promote a not-selected lottery applicant into a confirmed spot.

        Used after a draw when a winner drops out or extra capacity opens up.
        Confirms the applicant and emails them the same "you got a spot" notice
        winners receive.
        """
        try:
            ep = EventParticipant.objects.select_related("participant", "event").get(
                id=ep_id, event_id=pk
            )
        except EventParticipant.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        event = ep.event
        if not event.is_lottery:
            return Response(
                {"detail": "This event is not in lottery mode."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ep.is_lottery_lost or ep.is_cancelled:
            return Response(
                {"detail": "This applicant is not in the not-selected pool."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if event.max_participants is not None:
            available = event.max_participants - event.participant_count - event.pending_count
            if ep.participant.quantity > available:
                return Response(
                    {"detail": f"Not enough spots available. Only {available} spot(s) free."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        ep.is_lottery_lost = False
        ep.is_confirmed = True
        ep.save(update_fields=["is_lottery_lost", "is_confirmed"])

        from apps.event.utils import send_lottery_won_email
        send_lottery_won_email(event, ep.participant)

        return Response({"ep_id": ep.id, "is_lottery_lost": False, "is_confirmed": True})

    @action(detail=True, methods=["post"], url_path="preview-lottery-draw")
    def preview_lottery_draw(self, request, pk=None):
        """Return a dry-run draw result without persisting or emailing."""
        try:
            event = OrganizedEvent.objects.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not event.is_lottery:
            return Response(
                {"detail": "This event is not in lottery mode."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if event.lottery_drawn_at is not None:
            return Response(
                {"detail": "The lottery for this event has already been drawn."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.event.utils import compute_lottery_draw
        seed = request.data.get("seed")
        if seed is not None:
            seed = int(seed)
        reserved = request.data.get("reserved_member_slots", 0)
        result = compute_lottery_draw(event, seed=seed, reserved_member_slots=reserved)
        return Response(result)

    @action(detail=True, methods=["post"], url_path="run-lottery-draw")
    def run_lottery_draw(self, request, pk=None):
        """Run the random draw for a lottery-mode event."""
        try:
            event = OrganizedEvent.objects.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not event.is_lottery:
            return Response(
                {"detail": "This event is not in lottery mode."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if event.lottery_drawn_at is not None:
            return Response(
                {"detail": "The lottery for this event has already been drawn."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seed = request.data.get("seed")
        if seed is not None:
            seed = int(seed)
        reserved = request.data.get("reserved_member_slots", 0)

        from apps.event.utils import run_lottery_draw as _run_draw
        result = _run_draw(event, seed=seed, reserved_member_slots=reserved)
        event.refresh_from_db()
        return Response({
            "winners": result["winners"],
            "losers": result["losers"],
            "entries": result["entries"],
            "lottery_drawn_at": event.lottery_drawn_at,
        })

    @action(detail=True, methods=["post"], url_path="send-test-lottery-emails")
    def send_test_lottery_emails(self, request, pk=None):
        """Send one sample "won" and one sample "not selected" lottery email to a
        test address. The draw is NOT run and no real participant is emailed —
        random participants are only used to fill in the email content.
        """
        try:
            event = OrganizedEvent.objects.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if not event.is_lottery:
            return Response(
                {"detail": "This event is not in lottery mode."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        test_email = (request.data.get("email") or "").strip()
        if not test_email:
            return Response(
                {"detail": "A recipient email address is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.core.validators import validate_email
        try:
            validate_email(test_email)
        except ValidationError:
            return Response(
                {"detail": "Please enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Pick up to two random participants purely to populate the email content.
        entries = list(
            EventParticipant.objects.select_related("participant")
            .filter(event=event, is_cancelled=False)
            .order_by("?")[:2]
        )

        def _placeholder():
            return Participant(
                first_name="Sample", last_name="Participant",
                email=test_email, quantity=1,
            )

        won_participant = entries[0].participant if entries else _placeholder()
        if len(entries) >= 2:
            lost_participant = entries[1].participant
        elif entries:
            lost_participant = entries[0].participant
        else:
            lost_participant = _placeholder()

        from apps.event.utils import send_lottery_won_email, send_lottery_lost_email
        send_lottery_won_email(event, won_participant, to_email=test_email)
        send_lottery_lost_email(event, lost_participant, to_email=test_email)

        return Response({
            "detail": f"Sent sample 'won' and 'not selected' emails to {test_email}.",
        })

    @action(detail=True, methods=["post"], url_path="send-followup-email")
    def send_followup_email(self, request, pk=None):
        """Send an ad-hoc follow-up email to all confirmed participants.

        Body: ``{"subject": str, "body": str, "test_email": str?}``.
        When ``test_email`` is provided the message is sent only to that
        address (using a sample/first participant for placeholder values) and
        no real participant is contacted.
        """
        try:
            event = OrganizedEvent.objects.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        subject = (request.data.get("subject") or "").strip()
        body = (request.data.get("body") or "").strip()
        if not subject:
            return Response(
                {"detail": "A subject is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not body:
            return Response(
                {"detail": "An email body is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.event.utils import send_followup_email

        # Test mode: send a single sample to the given address.
        test_email = (request.data.get("test_email") or "").strip()
        if test_email:
            from django.core.validators import validate_email
            try:
                validate_email(test_email)
            except ValidationError:
                return Response(
                    {"detail": "Please enter a valid email address."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sample = (
                EventParticipant.objects.select_related("participant")
                .filter(event=event, is_confirmed=True, is_cancelled=False, is_waitlisted=False)
                .order_by("registered_at")
                .first()
            )
            participant = sample.participant if sample else Participant(
                first_name="Sample", last_name="Participant",
                email=test_email, quantity=1,
            )
            try:
                send_followup_email(event, participant, subject, body, to_email=test_email)
            except Exception as exc:
                return Response(
                    {"detail": f"Failed to send test email: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response({"detail": f"Sent a test follow-up email to {test_email}."})

        # Real send: every confirmed, non-cancelled participant (deduped by email).
        confirmed = (
            EventParticipant.objects.select_related("participant")
            .filter(event=event, is_confirmed=True, is_cancelled=False, is_waitlisted=False)
            .order_by("registered_at")
        )
        seen = set()
        sent = 0
        failed = 0
        for ep in confirmed:
            p = ep.participant
            email = (p.email or "").strip().lower()
            if not email or email in seen:
                continue
            seen.add(email)
            try:
                send_followup_email(event, p, subject, body)
                sent += 1
            except Exception as exc:
                failed += 1
                # logged inside the helper; keep going for the rest
                pass

        if sent == 0 and failed == 0:
            return Response(
                {"detail": "No confirmed participants to email."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        detail = f"Follow-up email sent to {sent} participant(s)."
        if failed:
            detail += f" {failed} failed to send."
        return Response({"detail": detail, "sent": sent, "failed": failed})

    @action(detail=True, methods=["post"], url_path="regenerate-guide-token")
    def regenerate_guide_token(self, request, pk=None):
        """Issue a new guide token, invalidating the previous magic link."""
        try:
            event = OrganizedEvent.objects.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        event.guide_token = _uuid.uuid4()
        event.save(update_fields=["guide_token"])
        return Response({"guide_token": str(event.guide_token)})


def _group_field_options(events):
    """
    Extra-info fields that can be made quick-edit on a group: every property in
    the group's event schemas plus the built-in console questions (so e.g.
    driving can be collected at check-in even if it wasn't asked at signup).
    """
    options = {}
    for event in events:
        props = (_inject_dynamic_questions(event) or {}).get("properties") or {}
        for key, prop in props.items():
            options.setdefault(key, prop)
    for key, (_flag, prop) in DYNAMIC_QUESTIONS.items():
        options.setdefault(key, prop)
    return [
        {
            "key": key,
            "title": prop.get("title") or key,
            "type": prop.get("type") or "string",
            "enum": prop.get("enum"),
        }
        for key, prop in options.items()
        if not key.startswith("_")
    ]


def _serialize_event_group(group, include_bookings=False, for_guide=False):
    events = list(group.events.select_related("image", "group").order_by("start_date", "title"))
    data = {
        "id": group.id,
        "name": group.name,
        "slug": group.slug,
        "description": group.description,
        "is_active": group.is_active,
        "quick_edit_fields": group.quick_edit_fields or [],
        "checkpoint_labels": group.checkpoint_labels,
        "field_options": _group_field_options(events),
        "allocations": [
            {
                "id": a.id,
                "name": a.name,
                "total_slots": a.total_slots,
                "remaining": a.remaining,
                "is_active": a.is_active,
            }
            for a in group.allocations.all()
        ],
        "events": [],
    }
    if not for_guide:
        data["guide_token"] = str(group.guide_token)
    for event in events:
        ev = {
            "id": event.id,
            "title": event.title,
            "start_date": event.start_date,
            "end_date": event.end_date,
            "location": event.location,
            "max_participants": event.max_participants,
            "is_active": event.is_active,
            "json_schema": _inject_dynamic_questions(event),
            "stats": {
                "confirmed": event.participant_count,
                "pending": event.pending_count,
            },
        }
        if include_bookings:
            # Same shape as the guide view: participant details, no payment info.
            ev["bookings"] = [
                {
                    **{k: v for k, v in b.items() if k != "payment"},
                    "allocation": (b["payment"] or {}).get("allocation"),
                }
                for b in _serialize_bookings(event)
            ]
        data["events"].append(ev)
    return data


def _clean_field_value(option, value):
    """Validate a quick-edit value against its field option. Returns (value, error)."""
    if value is None or value == "":
        return None, None
    if option.get("enum"):
        if value not in option["enum"]:
            return None, f"{option['key']} must be one of {', '.join(map(str, option['enum']))}"
        return value, None
    if option["type"] == "boolean":
        if not isinstance(value, bool):
            return None, f"{option['key']} must be true or false"
        return value, None
    if option["type"] in ("number", "integer"):
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None, f"{option['key']} must be a number"
        return (int(num) if option["type"] == "integer" else num), None
    if not isinstance(value, str):
        return None, f"{option['key']} must be text"
    return value.strip()[:500] or None, None


def _quick_edit_options(group):
    """Field options for the group's current quick-edit fields, keyed by field."""
    events = list(group.events.all())
    by_key = {o["key"]: o for o in _group_field_options(events)}
    return {k: by_key[k] for k in (group.quick_edit_fields or []) if k in by_key}


def _add_group_participant(group, data, source):
    """
    Add a walk-in / manual participant to one of the group's events. Only a
    name and phone are required; quick-edit field values are optional. No
    registration (payment) record is created and capacity isn't enforced —
    whoever adds them is vouching for the seat.
    """
    try:
        event = group.events.get(pk=data.get("event_id"))
    except (OrganizedEvent.DoesNotExist, ValueError, TypeError):
        return None, Response({"detail": "Choose an event in this group"}, status=status.HTTP_400_BAD_REQUEST)

    name = (data.get("name") or "").strip()
    phone = (data.get("phone_number") or "").strip()
    email = (data.get("email") or "").strip()
    if not name:
        return None, Response({"detail": "Full name is required"}, status=status.HTTP_400_BAD_REQUEST)
    if not phone:
        return None, Response({"detail": "Contact number is required"}, status=status.HTTP_400_BAD_REQUEST)
    if len(phone) > 20:
        return None, Response({"detail": "Contact number is too long"}, status=status.HTTP_400_BAD_REQUEST)
    if email:
        try:
            EmailValidator()(email)
        except ValidationError:
            return None, Response({"detail": "Enter a valid email"}, status=status.HTTP_400_BAD_REQUEST)

    slot = {"_added_via": source}
    options = _quick_edit_options(group)
    for key, value in (data.get("extra") or {}).items():
        if key not in options:
            continue
        cleaned, err = _clean_field_value(options[key], value)
        if err:
            return None, Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        if cleaned is not None:
            slot[key] = cleaned

    first, _, last = name.partition(" ")
    participant = Participant.objects.create(
        first_name=first[:100], last_name=last.strip()[:100], email=email, phone_number=phone, quantity=1,
    )
    EventParticipant.objects.create(
        event=event, participant=participant, is_confirmed=True, extra_json=[slot],
    )
    return event, None


def _set_group_extra_field(group, ep, data):
    """Set one quick-edit field on one person's extra_json slot."""
    key = data.get("key")
    options = _quick_edit_options(group)
    if key not in options:
        return Response({"detail": "Not a quick-edit field"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        slot_idx = int(data.get("slot", 0))
    except (TypeError, ValueError):
        slot_idx = -1
    if slot_idx < 0 or slot_idx >= max(ep.participant.quantity, 1):
        return Response({"detail": "Invalid slot"}, status=status.HTTP_400_BAD_REQUEST)
    value, err = _clean_field_value(options[key], data.get("value"))
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        ep = EventParticipant.objects.select_for_update().get(pk=ep.pk)
        slots = ep.extra_json
        if isinstance(slots, dict):
            slots = [slots]
        elif not isinstance(slots, list):
            slots = []
        slots = [dict(s) if isinstance(s, dict) else {} for s in slots]
        while len(slots) <= slot_idx:
            slots.append({})
        if value is None:
            slots[slot_idx].pop(key, None)
        else:
            slots[slot_idx][key] = value
        ep.extra_json = slots
        ep.save(update_fields=["extra_json"])
    return Response({"ep_id": ep.id, "extra_json": ep.extra_json})


def _toggle_checkpoint(ep, data, allowed):
    """
    Mark / unmark one person (``slot``) at checkpoint 1 or 2. Marks record when
    they were made. ``attended`` mirrors whether anyone is in at checkpoint 1.
    """
    try:
        checkpoint = int(data.get("checkpoint"))
        slot_idx = int(data.get("slot", 0))
    except (TypeError, ValueError):
        return Response({"detail": "checkpoint and slot must be numbers"}, status=status.HTTP_400_BAD_REQUEST)
    if checkpoint not in allowed:
        return Response({"detail": "Checkpoint not editable here"}, status=status.HTTP_400_BAD_REQUEST)
    if slot_idx < 0 or slot_idx >= max(ep.participant.quantity, 1):
        return Response({"detail": "Invalid slot"}, status=status.HTTP_400_BAD_REQUEST)

    key = str(checkpoint)
    with transaction.atomic():
        ep = EventParticipant.objects.select_for_update().select_related("participant").get(pk=ep.pk)
        qty = max(ep.participant.quantity, 1)
        marks = [dict(m) if isinstance(m, dict) else {} for m in (ep.checkpoints or [])]
        if not marks and ep.attended:
            # Marked attended before checkpoints existed: everyone counts as checked in.
            marks = [{"1": True} for _ in range(qty)]
        while len(marks) < qty:
            marks.append({})
        if marks[slot_idx].get(key):
            marks[slot_idx].pop(key)
        else:
            marks[slot_idx][key] = timezone.now().isoformat()
        ep.checkpoints = marks
        ep.attended = any(m.get("1") for m in marks[:qty])
        ep.save(update_fields=["checkpoints", "attended"])
    return Response({"ep_id": ep.id, "checkpoints": ep.checkpoints, "attended": ep.attended})


def _get_group_ep(group, ep_id):
    return EventParticipant.objects.select_related("participant").get(id=ep_id, event__group=group)


class ConsoleEventGroupsView(APIView):
    """List event groups with per-event headline stats."""
    permission_classes = [IsEventsStaff]

    def get(self, request):
        groups = EventGroup.objects.prefetch_related("allocations").order_by("name")
        return Response([_serialize_event_group(g) for g in groups])


class ConsoleEventGroupDetailView(APIView):
    """One event group with every participant across all of its events."""
    permission_classes = [IsEventsStaff]

    def _get(self, group_id):
        return EventGroup.objects.prefetch_related("allocations").get(pk=group_id)

    def get(self, request, group_id: int):
        try:
            group = self._get(group_id)
        except EventGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_event_group(group, include_bookings=True))

    def patch(self, request, group_id: int):
        """Update the group's quick-edit fields and checkpoint labels."""
        try:
            group = self._get(group_id)
        except EventGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if "quick_edit_fields" in request.data:
            keys = request.data["quick_edit_fields"]
            if not isinstance(keys, list) or not all(isinstance(k, str) for k in keys):
                return Response({"detail": "quick_edit_fields must be a list of field keys"}, status=status.HTTP_400_BAD_REQUEST)
            valid = {o["key"] for o in _group_field_options(list(group.events.all()))}
            unknown = [k for k in keys if k not in valid]
            if unknown:
                return Response({"detail": f"Unknown field(s): {', '.join(unknown)}"}, status=status.HTTP_400_BAD_REQUEST)
            group.quick_edit_fields = list(dict.fromkeys(keys))
            group.save(update_fields=["quick_edit_fields", "updated_at"])
        if "checkpoint_labels" in request.data:
            labels = request.data["checkpoint_labels"]
            if (
                not isinstance(labels, list) or len(labels) != 2
                or not all(isinstance(l, str) and l.strip() for l in labels)
            ):
                return Response({"detail": "checkpoint_labels must be two names"}, status=status.HTTP_400_BAD_REQUEST)
            group.checkpoint_labels = [l.strip()[:40] for l in labels]
            group.save(update_fields=["checkpoint_labels", "updated_at"])
        return Response({
            "quick_edit_fields": group.quick_edit_fields,
            "checkpoint_labels": group.checkpoint_labels,
        })


class ConsoleEventGroupParticipantsView(APIView):
    """Add a participant to one of the group's events."""
    permission_classes = [IsEventsStaff]

    def post(self, request, group_id: int):
        try:
            group = EventGroup.objects.get(pk=group_id)
        except EventGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        _event, err = _add_group_participant(group, request.data, source="console")
        if err:
            return err
        return Response(_serialize_event_group(group, include_bookings=True), status=status.HTTP_201_CREATED)


class ConsoleEventGroupExtraFieldView(APIView):
    permission_classes = [IsEventsStaff]

    def patch(self, request, group_id: int, ep_id: int):
        try:
            group = EventGroup.objects.get(pk=group_id)
            ep = _get_group_ep(group, ep_id)
        except (EventGroup.DoesNotExist, EventParticipant.DoesNotExist):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return _set_group_extra_field(group, ep, request.data)


class ConsoleEventGroupCheckpointView(APIView):
    """Console can mark either checkpoint (group page uses 1, event pages use 2)."""
    permission_classes = [IsEventsStaff]

    def post(self, request, group_id: int, ep_id: int):
        try:
            group = EventGroup.objects.get(pk=group_id)
            ep = _get_group_ep(group, ep_id)
        except (EventGroup.DoesNotExist, EventParticipant.DoesNotExist):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return _toggle_checkpoint(ep, request.data, allowed=(1, 2))


class ConsoleEventGroupGuideTokenView(APIView):
    permission_classes = [IsEventsStaff]

    def post(self, request, group_id: int):
        """Issue a new group guide token, invalidating the previous magic link."""
        try:
            group = EventGroup.objects.get(pk=group_id)
        except EventGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        group.guide_token = _uuid.uuid4()
        group.save(update_fields=["guide_token"])
        return Response({"guide_token": str(group.guide_token)})


# ─── Group guide access (no auth — token-gated) ───────────────────────────────


def _guide_group(token):
    return EventGroup.objects.prefetch_related("allocations").get(guide_token=token)


class GuideEventGroupView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            group = _guide_group(token)
        except (EventGroup.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_event_group(group, include_bookings=True, for_guide=True))


class GuideEventGroupParticipantsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        try:
            group = _guide_group(token)
        except (EventGroup.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        _event, err = _add_group_participant(group, request.data, source="guide")
        if err:
            return err
        return Response(
            _serialize_event_group(group, include_bookings=True, for_guide=True),
            status=status.HTTP_201_CREATED,
        )


class GuideEventGroupParticipantView(APIView):
    """Checkpoint 1, notes and quick-edit fields for one participant in the group."""
    permission_classes = [permissions.AllowAny]

    def _lookup(self, token, ep_id):
        group = _guide_group(token)
        return group, _get_group_ep(group, ep_id)

    def post(self, request, token, ep_id):
        """Mark / unmark one person at the group's first checkpoint."""
        try:
            _group, ep = self._lookup(token, ep_id)
        except (EventGroup.DoesNotExist, EventParticipant.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return _toggle_checkpoint(ep, {**request.data, "checkpoint": 1}, allowed=(1,))

    def patch(self, request, token, ep_id):
        """Update notes, or one quick-edit field when ``key`` is given."""
        try:
            group, ep = self._lookup(token, ep_id)
        except (EventGroup.DoesNotExist, EventParticipant.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if "key" in request.data:
            return _set_group_extra_field(group, ep, request.data)
        if "notes" in request.data:
            ep.notes = request.data["notes"]
            ep.save(update_fields=["notes"])
        return Response({"ep_id": ep.id, "notes": ep.notes})


class GuideEventView(APIView):
    """Read-only event + participant list, authenticated by guide token only."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            event = OrganizedEvent.objects.select_related("image").get(guide_token=token)
        except (OrganizedEvent.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_event_for_guide(event))


class GuideToggleAttendanceView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token, ep_id):
        try:
            event = OrganizedEvent.objects.get(guide_token=token)
            ep = EventParticipant.objects.get(id=ep_id, event=event)
        except (OrganizedEvent.DoesNotExist, EventParticipant.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        ep.attended = not ep.attended
        ep.save(update_fields=["attended"])
        return Response({"ep_id": ep.id, "attended": ep.attended})


class GuideCheckpointView(APIView):
    """An event's guide link marks the group's second checkpoint (grouped events only)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, token, ep_id):
        try:
            event = OrganizedEvent.objects.get(guide_token=token, group__isnull=False)
            ep = EventParticipant.objects.select_related("participant").get(id=ep_id, event=event)
        except (OrganizedEvent.DoesNotExist, EventParticipant.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return _toggle_checkpoint(ep, {**request.data, "checkpoint": 2}, allowed=(2,))


class GuideUpdateNotesView(APIView):
    permission_classes = [permissions.AllowAny]

    def patch(self, request, token, ep_id):
        try:
            event = OrganizedEvent.objects.get(guide_token=token)
            ep = EventParticipant.objects.get(id=ep_id, event=event)
        except (OrganizedEvent.DoesNotExist, EventParticipant.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if "notes" in request.data:
            ep.notes = request.data["notes"]
            ep.save(update_fields=["notes"])
        return Response({"ep_id": ep.id, "notes": ep.notes})


class ConsoleVerifyRegistrationView(APIView):
    permission_classes = [IsEventsStaff]

    def post(self, request, reg_id: int):
        try:
            reg = EventRegistration.objects.select_related("event", "participant").get(id=reg_id)
        except EventRegistration.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if reg.payment_verified:
            return Response({"detail": "Already verified"}, status=status.HTTP_400_BAD_REQUEST)
        reg.verify(user=request.user)
        return Response({
            "id": reg.id,
            "reference": reg.reference,
            "status": reg.status,
            "payment_verified": reg.payment_verified,
            "payment_verified_on": reg.payment_verified_on,
        })


class ConsoleVerifyGroupView(APIView):
    permission_classes = [IsEventsStaff]

    def post(self, request, group_id: int):
        try:
            grp = EventRegistrationGroup.objects.get(id=group_id)
        except EventRegistrationGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if grp.payment_verified:
            return Response({"detail": "Already verified"}, status=status.HTTP_400_BAD_REQUEST)
        grp.verify(user=request.user)
        return Response({
            "id": grp.id,
            "reference": grp.reference,
            "status": grp.status,
            "payment_verified": grp.payment_verified,
            "payment_verified_on": grp.payment_verified_on,
        })


class ConsoleRegistrationToggleView(APIView):
    permission_classes = [IsEventsStaff]

    def get(self, request):
        return Response({"registration_closed": get_global_registration_closed()})

    def post(self, request):
        closed = bool(request.data.get("registration_closed", False))
        set_global_registration_closed(closed)
        return Response({"registration_closed": get_global_registration_closed()})


class ConsoleEventTagsView(APIView):
    permission_classes = [IsEventsStaff]

    def get(self, request):
        """Return all unique tags used across all events."""
        all_tags = set()
        for tags in OrganizedEvent.objects.values_list("tags", flat=True):
            if tags:
                all_tags.update(tags)
        return Response(sorted(all_tags))


class EventImageView(APIView):
    permission_classes = [IsEventsStaff]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        images = EventImage.objects.all()
        return Response([
            {"id": img.id, "url": img.file.url, "uploaded_at": img.uploaded_at}
            for img in images
        ])

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)
        img = EventImage.objects.create(file=upload)
        return Response(
            {"id": img.id, "url": img.file.url, "uploaded_at": img.uploaded_at},
            status=status.HTTP_201_CREATED,
        )
