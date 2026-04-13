from decimal import Decimal, InvalidOperation

from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

import logging

logger = logging.getLogger(__name__)


class DonationCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from apps.payment.models import Donation

        name = (request.data.get("name") or "").strip()
        amount_raw = request.data.get("amount")
        email = (request.data.get("email") or "").strip()
        note = (request.data.get("note") or "").strip()
        reference = (request.data.get("reference") or "").strip()

        errors = {}

        if not name:
            errors["name"] = "Name is required"

        try:
            amount = Decimal(str(amount_raw))
            if amount <= 0:
                errors["amount"] = "Amount must be greater than zero"
        except (InvalidOperation, TypeError):
            errors["amount"] = "A valid amount is required"

        if not reference:
            errors["reference"] = "Reference is required"

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            donation = Donation.objects.create(
                name=name,
                amount=amount,
                email=email,
                note=note,
                reference=reference[:25],
            )
            logger.info(f"Donation recorded: {donation.reference} — ${donation.amount}")
            return Response({"success": True}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Failed to record donation: {e}")
            return Response(
                {"success": False, "message": "Failed to record donation"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
