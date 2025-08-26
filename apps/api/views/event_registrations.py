from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from oscar.core.loading import get_model


EventRegistration = get_model("event", "EventRegistration")


class EventRegistrationDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, reg_id: int):
        try:
            reg = EventRegistration._default_manager.select_related("event", "participant").get(id=reg_id)
        except EventRegistration.DoesNotExist:
            return Response({"detail": "Registration not found"}, status=status.HTTP_404_NOT_FOUND)

        p = reg.participant
        data = {
            "id": reg.id,
            "event": reg.event.id,
            "participant": {
                "id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "email": p.email,
                "phone_number": p.phone_number,
                "quantity": p.quantity,
            },
            "amount": str(reg.amount),
            "currency": reg.currency,
            "reference": reg.reference,
            "status": reg.status,
            "payment_verified": reg.payment_verified,
            "payment_verified_on": reg.payment_verified_on,
        }
        return Response(data)


class EventRegistrationProofUploadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, reg_id: int):
        try:
            reg = EventRegistration._default_manager.get(id=reg_id)
        except EventRegistration.DoesNotExist:
            return Response({"detail": "Registration not found"}, status=status.HTTP_404_NOT_FOUND)

        upload = request.FILES.get("payment_proof")
        if not upload:
            return Response({"detail": "payment_proof file is required"}, status=status.HTTP_400_BAD_REQUEST)

        from django.core.files.base import ContentFile
        from os.path import basename

        content = upload.read()
        reg.payment_proof.save(basename(upload.name), ContentFile(content), save=True)

        return Response({
            "id": reg.id,
            "reference": reg.reference,
            "uploaded": True,
        }, status=status.HTTP_201_CREATED)

