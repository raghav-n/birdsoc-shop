"""
Console-side event management API.
All endpoints require the user to be in the 'Events' group (or be a superuser).
"""
import uuid as _uuid
from urllib.parse import urlparse
from datetime import datetime
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
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
        "guide_token": str(event.guide_token),
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
    for reg in EventRegistration.objects.select_related("group").filter(event=event):
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
        qs = OrganizedEvent.objects.select_related("image").order_by("-start_date")
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
