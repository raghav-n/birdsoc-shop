from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from oscar.core.loading import get_model


EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")


class EventRegistrationDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, reg_id: int):
        try:
            reg = EventRegistration._default_manager.select_related(
                "event", "participant"
            ).get(id=reg_id)
        except EventRegistration.DoesNotExist:
            return Response(
                {"detail": "Registration not found"}, status=status.HTTP_404_NOT_FOUND
            )

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
                "emergency_contact_name": p.emergency_contact_name,
                "emergency_contact_phone": p.emergency_contact_phone,
                "quantity": p.quantity,
            },
            "amount": str(reg.amount),
            "donation_amount": str(reg.donation_amount),
            "amount_with_donation": str(reg.amount + reg.donation_amount),
            "currency": reg.currency,
            "reference": reg.reference,
            "emergency_contact_name": reg.emergency_contact_name,
            "emergency_contact_phone": reg.emergency_contact_phone,
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
            return Response(
                {"detail": "Registration not found"}, status=status.HTTP_404_NOT_FOUND
            )

        upload = request.FILES.get("payment_proof")
        if not upload:
            return Response(
                {"detail": "payment_proof file is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.core.files.base import ContentFile
        from os.path import basename

        content = upload.read()
        reg.payment_proof.save(basename(upload.name), ContentFile(content), save=True)

        return Response(
            {
                "id": reg.id,
                "reference": reg.reference,
                "uploaded": True,
            },
            status=status.HTTP_201_CREATED,
        )


class EventRegistrationGroupDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, group_id: int):
        try:
            grp = EventRegistrationGroup._default_manager.select_related("event").get(
                id=group_id
            )
        except EventRegistrationGroup.DoesNotExist:
            return Response(
                {"detail": "Group not found"}, status=status.HTTP_404_NOT_FOUND
            )

        regs = (
            EventRegistration._default_manager.select_related("participant")
            .filter(group=grp)
            .all()
        )

        items = []
        for reg in regs:
            p = reg.participant
            items.append(
                {
                    "registration": {
                        "id": reg.id,
                        "reference": reg.reference,
                        "amount": str(reg.amount),
                        "donation_amount": str(reg.donation_amount),
                        "amount_with_donation": str(reg.amount + reg.donation_amount),
                        "currency": reg.currency,
                        "emergency_contact_name": reg.emergency_contact_name,
                        "emergency_contact_phone": reg.emergency_contact_phone,
                        "status": reg.status,
                        "payment_verified": reg.payment_verified,
                    },
                    "participant": {
                        "id": p.id,
                        "first_name": p.first_name,
                        "last_name": p.last_name,
                        "email": p.email,
                        "phone_number": p.phone_number,
                        "emergency_contact_name": p.emergency_contact_name,
                        "emergency_contact_phone": p.emergency_contact_phone,
                        "quantity": p.quantity,
                    },
                }
            )

        data = {
            "id": grp.id,
            "event": grp.event.id,
            "payer_name": grp.payer_name,
            "payer_email": grp.payer_email,
            "payer_phone": grp.payer_phone,
            "amount_total": str(grp.amount_total),
            "donation_amount": str(grp.donation_amount),
            "amount_total_with_donation": str(grp.amount_total + grp.donation_amount),
            "currency": grp.currency,
            "reference": grp.reference,
            "status": grp.status,
            "payment_verified": grp.payment_verified,
            "payment_verified_on": grp.payment_verified_on,
            "items": items,
        }
        return Response(data)


class EventRegistrationGroupProofUploadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, group_id: int):
        try:
            grp = EventRegistrationGroup._default_manager.get(id=group_id)
        except EventRegistrationGroup.DoesNotExist:
            return Response(
                {"detail": "Group not found"}, status=status.HTTP_404_NOT_FOUND
            )

        upload = request.FILES.get("payment_proof")
        if not upload:
            return Response(
                {"detail": "payment_proof file is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.core.files.base import ContentFile
        from os.path import basename

        content = upload.read()
        grp.payment_proof.save(basename(upload.name), ContentFile(content), save=True)

        return Response(
            {
                "id": grp.id,
                "reference": grp.reference,
                "uploaded": True,
            },
            status=status.HTTP_201_CREATED,
        )
