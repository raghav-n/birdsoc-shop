from decimal import Decimal

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from oscar.core.loading import get_model

from apps.util.gmail_client import (
    build_gmail_service,
    find_paynow_email_for_event_registration,
    GmailClientError,
)
from apps.event.utils import send_payment_confirmation_email, send_group_payment_confirmation_emails

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


class EventRegistrationPayNowEmailCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, reg_id: int):
        try:
            reg = EventRegistration._default_manager.select_related("event", "participant").get(id=reg_id)
        except EventRegistration.DoesNotExist:
            return Response({"detail": "Registration not found"}, status=status.HTTP_404_NOT_FOUND)

        if reg.payment_verified:
            return Response({"confirmed": True, "already_confirmed": True})

        try:
            service = build_gmail_service()
        except GmailClientError:
            return Response(
                {"detail": "PayNow email verification is not configured."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        max_age = int(getattr(settings, "GMAIL_MAX_AGE_MINUTES", 60) or 60)
        try:
            found = find_paynow_email_for_event_registration(
                service,
                reference=reg.reference,
                subject_query=getattr(settings, "GMAIL_POLL_QUERY", None),
                max_age_minutes=max_age,
            )
        except GmailClientError:
            return Response(
                {"detail": "PayNow email verification is currently unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not found:
            return Response({"confirmed": False, "found": False})

        try:
            amount = Decimal(found["amount"])
        except Exception:
            return Response({"confirmed": False, "found": True, "amount": found["amount"], "message": "Unable to parse amount from email"})

        expected = reg.amount + (reg.donation_amount or Decimal("0"))
        if amount != expected:
            return Response({
                "confirmed": False,
                "found": True,
                "amount": found["amount"],
                "message": f"Amount mismatch. Expected SGD {expected}.",
            })

        from django.utils import timezone
        reg.payment_verified = True
        reg.payment_verified_on = timezone.now()
        reg.status = "confirmed"
        reg.save(update_fields=["payment_verified", "payment_verified_on", "status"])

        send_payment_confirmation_email(reg)

        return Response({"confirmed": True, "amount": found["amount"]})


class EventRegistrationGroupPayNowEmailCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, group_id: int):
        try:
            grp = EventRegistrationGroup._default_manager.select_related("event").get(id=group_id)
        except EventRegistrationGroup.DoesNotExist:
            return Response({"detail": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

        if grp.payment_verified:
            return Response({"confirmed": True, "already_confirmed": True})

        try:
            service = build_gmail_service()
        except GmailClientError:
            return Response(
                {"detail": "PayNow email verification is not configured."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        max_age = int(getattr(settings, "GMAIL_MAX_AGE_MINUTES", 60) or 60)
        try:
            found = find_paynow_email_for_event_registration(
                service,
                reference=grp.reference,
                subject_query=getattr(settings, "GMAIL_POLL_QUERY", None),
                max_age_minutes=max_age,
            )
        except GmailClientError:
            return Response(
                {"detail": "PayNow email verification is currently unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not found:
            return Response({"confirmed": False, "found": False})

        try:
            amount = Decimal(found["amount"])
        except Exception:
            return Response({"confirmed": False, "found": True, "amount": found["amount"], "message": "Unable to parse amount from email"})

        expected = grp.amount_total + (grp.donation_amount or Decimal("0"))
        if amount != expected:
            return Response({
                "confirmed": False,
                "found": True,
                "amount": found["amount"],
                "message": f"Amount mismatch. Expected SGD {expected}.",
            })

        from django.utils import timezone
        grp.payment_verified = True
        grp.payment_verified_on = timezone.now()
        grp.status = "confirmed"
        grp.save(update_fields=["payment_verified", "payment_verified_on", "status"])
        grp.registrations.filter(status="pending").update(status="confirmed")

        send_group_payment_confirmation_emails(grp)

        return Response({"confirmed": True, "amount": found["amount"]})
