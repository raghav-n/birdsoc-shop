from decimal import Decimal
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from oscar.core.loading import get_model

from apps.util.gmail_client import (
    build_gmail_service,
    find_paynow_email_for_order,
    GmailClientError,
)
from apps.util.payments import confirm_paynow_payment, PaymentConfirmationError


Order = get_model("order", "Order")


class PayNowGmailCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        order_number = request.query_params.get("order") or request.query_params.get(
            "order_number"
        )
        if not order_number:
            return Response(
                {"detail": "order (order_number) query param is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order = Order._default_manager.get(number=order_number)
        except Order.DoesNotExist:
            return Response(
                {"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # If already confirmed, short-circuit
        if order.payment_events.filter(
            event_type__code__in=["paynow-auto-verified", "paynow-verified"]
        ).exists():
            return Response({"confirmed": True, "already_confirmed": True})

        # Build Gmail service
        try:
            service = build_gmail_service()
        except GmailClientError as e:
            return Response({"detail": str(e)}, status=status.HTTP_501_NOT_IMPLEMENTED)

        # Search for a recent email for this order
        max_age = int(getattr(settings, "GMAIL_MAX_AGE_MINUTES", 60) or 60)
        try:
            found = find_paynow_email_for_order(
                service,
                order_number=order.number,
                subject_query=getattr(settings, "GMAIL_POLL_QUERY", None),
                max_age_minutes=max_age,
            )
        except GmailClientError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        if not found:
            return Response({"confirmed": False, "found": False})

        amount_str, received_at = found

        # Validate the amount matches
        try:
            amount = Decimal(amount_str)
        except Exception:
            return Response(
                {
                    "confirmed": False,
                    "found": True,
                    "amount": amount_str,
                    "message": "Unable to parse amount from email",
                }
            )

        if order.total_incl_tax_with_donation != amount:
            return Response(
                {
                    "confirmed": False,
                    "found": True,
                    "amount": amount_str,
                    "message": f"Amount mismatch. Expected SGD {order.total_incl_tax_with_donation}.",
                }
            )

        # Confirm the order
        try:
            confirm_paynow_payment(order, amount)
        except PaymentConfirmationError as e:
            return Response(
                {
                    "confirmed": False,
                    "found": True,
                    "amount": amount_str,
                    "message": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "confirmed": True,
                "found": True,
                "amount": amount_str,
                "email_timestamp": received_at.isoformat(),
            }
        )
