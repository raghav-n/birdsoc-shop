"""
Console-side event management API.
All endpoints require the user to be in the 'Events' group (or be a superuser).
"""
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from oscar.core.loading import get_model

from apps.api.permissions import IsEventsStaff
from apps.event.utils import get_global_registration_closed, set_global_registration_closed

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
        "price_incl_tax": str(event.price_incl_tax),
        "currency": event.currency,
        "json_schema": event.json_schema,
        "price_tiers": event.price_tiers,
        "validate_participant_data": event.validate_participant_data,
        "registration_required": event.registration_required,
        "confirmed_email_template": event.confirmed_email_template,
        "image_id": event.image_id,
        "image_url": event.image.file.url if event.image else None,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "stats": {
            "confirmed": event.participant_count,
            "pending": event.pending_count,
            "total_unique": event.unique_participant_count,
        },
    }
    if include_participants:
        data["participants"] = _serialize_participants(event)
        data["registrations"] = _serialize_registrations(event)
        data["groups"] = _serialize_groups(event)
    return data


def _serialize_participants(event):
    eps = (
        EventParticipant.objects.select_related("participant")
        .filter(event=event)
        .order_by("-registered_at")
    )
    results = []
    for ep in eps:
        p = ep.participant
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
            "is_main_contact": ep.is_main_contact,
            "attended": ep.attended,
            "notes": ep.notes,
            "extra_json": ep.extra_json,
        })
    return results


def _serialize_registrations(event):
    regs = (
        EventRegistration.objects.select_related("participant", "group")
        .filter(event=event, group__isnull=True)
        .order_by("-created_at")
    )
    results = []
    for reg in regs:
        p = reg.participant
        results.append({
            "id": reg.id,
            "reference": reg.reference,
            "participant": {
                "id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "email": p.email,
                "phone_number": p.phone_number,
                "quantity": p.quantity,
            },
            "amount": str(reg.amount),
            "donation_amount": str(reg.donation_amount),
            "amount_with_donation": str(reg.amount + reg.donation_amount),
            "currency": reg.currency,
            "status": reg.status,
            "payment_verified": reg.payment_verified,
            "payment_verified_on": reg.payment_verified_on,
            "payment_proof_url": reg.payment_proof.url if reg.payment_proof else None,
            "created_at": reg.created_at,
        })
    return results


def _serialize_groups(event):
    groups = (
        EventRegistrationGroup.objects.prefetch_related("registrations__participant")
        .filter(event=event)
        .order_by("-created_at")
    )
    results = []
    for grp in groups:
        participants = []
        for reg in grp.registrations.select_related("participant").all():
            p = reg.participant
            participants.append({
                "registration_id": reg.id,
                "reference": reg.reference,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "email": p.email,
                "quantity": p.quantity,
                "amount": str(reg.amount),
                "status": reg.status,
            })
        results.append({
            "id": grp.id,
            "reference": grp.reference,
            "payer_name": grp.payer_name,
            "payer_email": grp.payer_email,
            "payer_phone": grp.payer_phone,
            "amount_total": str(grp.amount_total),
            "donation_amount": str(grp.donation_amount),
            "amount_total_with_donation": str(grp.amount_total + grp.donation_amount),
            "currency": grp.currency,
            "status": grp.status,
            "payment_verified": grp.payment_verified,
            "payment_verified_on": grp.payment_verified_on,
            "payment_proof_url": grp.payment_proof.url if grp.payment_proof else None,
            "created_at": grp.created_at,
            "participants": participants,
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
        """Get a single event with full participant and registration data."""
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
        try:
            event = OrganizedEvent.objects.create(
                title=data["title"],
                description=data.get("description", ""),
                start_date=data["start_date"],
                end_date=data.get("end_date") or None,
                location=data.get("location", ""),
                max_participants=data.get("max_participants") or None,
                max_qty=int(data.get("max_qty") or 5),
                is_active=bool(data.get("is_active", True)),
                price_incl_tax=data.get("price_incl_tax", "0"),
                currency=data.get("currency", "SGD"),
                json_schema=data.get("json_schema") or None,
                price_tiers=data.get("price_tiers") or None,
                validate_participant_data=bool(data.get("validate_participant_data", False)),
                registration_required=bool(data.get("registration_required", True)),
                confirmed_email_template=data.get("confirmed_email_template") or None,
                image=image,
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
            "max_participants", "max_qty", "is_active", "price_incl_tax", "currency",
            "json_schema", "price_tiers", "validate_participant_data",
            "registration_required", "confirmed_email_template",
        ]
        for field in updatable:
            if field in data:
                val = data[field]
                if field in ("end_date", "max_participants", "json_schema", "price_tiers", "confirmed_email_template"):
                    if val == "" or val is None:
                        val = None
                elif field == "max_qty":
                    val = int(val or 5)
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
        for field in ("notes", "is_confirmed", "is_cancelled", "attended"):
            if field in data:
                setattr(ep, field, data[field])
                changed.append(field)
        if changed:
            ep.save(update_fields=changed)
        return Response({"ep_id": ep.id, "attended": ep.attended, "is_confirmed": ep.is_confirmed, "is_cancelled": ep.is_cancelled, "notes": ep.notes})


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
