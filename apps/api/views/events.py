from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from oscar.core.loading import get_model
from rest_framework import status
from django.core.validators import validate_email
from django.core.exceptions import ValidationError


OrganizedEvent = get_model("event", "OrganizedEvent")
Participant = get_model("event", "Participant")
EventParticipant = get_model("event", "EventParticipant")


class EventsViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]

    def list(self, request):
        qs = OrganizedEvent._default_manager.filter(is_active=True).order_by("start_date")
        data = [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "start_date": e.start_date,
                "end_date": e.end_date,
                "location": e.location,
                "participant_count": e.participant_count,
                "max_participants": e.max_participants,
                "is_full": e.is_full,
            }
            for e in qs
        ]
        return Response(data)

    def retrieve(self, request, pk=None):
        try:
            e = OrganizedEvent._default_manager.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        data = {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "start_date": e.start_date,
            "end_date": e.end_date,
            "location": e.location,
            "participant_count": e.participant_count,
            "max_participants": e.max_participants,
            "is_full": e.is_full,
        }
        return Response(data)

    @action(detail=True, methods=["post"], url_path="register")
    def register(self, request, pk=None):
        # Validate event
        try:
            event = OrganizedEvent._default_manager.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Event not found"}, status=status.HTTP_404_NOT_FOUND)

        # Extract fields
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        email = (request.data.get("email") or "").strip()
        phone_number = (request.data.get("phone_number") or "").strip()
        try:
            quantity = int(request.data.get("quantity", 1))
        except Exception:
            return Response({"detail": "quantity must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        if not first_name or not last_name or not email:
            return Response({"detail": "first_name, last_name, and email are required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_email(email)
        except ValidationError:
            return Response({"detail": "Invalid email"}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response({"detail": "quantity must be >= 1"}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent duplicate email registration for same event
        if EventParticipant._default_manager.filter(event=event, participant__email__iexact=email).exists():
            return Response({"detail": "This email is already registered for the event"}, status=status.HTTP_400_BAD_REQUEST)

        # Create a fresh participant per registration (quantity is per-registration)
        participant = Participant._default_manager.create(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone_number=phone_number,
            quantity=quantity,
        )

        # Respect capacity and duplication checks
        try:
            event_participant = event.add_participant(participant)
        except ValueError as e:
            # e.g., capacity exceeded or duplicate
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "event": event.id,
                "participant": {
                    "id": participant.id,
                    "first_name": participant.first_name,
                    "last_name": participant.last_name,
                    "email": participant.email,
                    "phone_number": participant.phone_number,
                    "quantity": participant.quantity,
                },
                "registered_at": event_participant.registered_at,
            },
            status=status.HTTP_201_CREATED,
        )
