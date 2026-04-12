from decimal import Decimal
from django.conf import settings
from django.core.mail import send_mail
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from oscar.core.loading import get_model

from apps.checkout.models import PendingCheckout
from apps.util.gmail_client import (
    build_gmail_service,
    find_paynow_email_for_order,
    GmailClientError,
)
from apps.util.payments import confirm_paynow_payment, PaymentConfirmationError
from apps.util.views import _place_order_from_pending


Order = get_model("order", "Order")

PAYNOW_TEST_EMAIL_SUBJECT = "PayNow Alert - You have received a payment via PayNow"


def _is_localhost_request(request):
    host = (request.get_host() or "").split(":")[0].lower()
    return host in {"localhost", "127.0.0.1"}


def _build_paynow_test_email_body(order_number: str, amount: Decimal) -> str:
    amount_str = f"{amount:.2f}"
    return (
        "Dear Valued Customer\n\n"
        f"S${amount_str} has been credited into your PayNow linked A/C ending 8024 "
        f"(ref-OTHR-MER-{order_number}) on 24 March 2026 at 13:54 (Singapore time).\n\n"
        "Please call +65 6777 0022 immediately if the funds received are from "
        "an unknown person. Do not directly refund any person claiming to have "
        "accidentally transfered fund to you.\n\n"
        "Thank you for banking with Maybank.\n\n\n\n"
        "Maybank Singapore Limited\n\n\n"
        "Please do not reply to this system-generated notification."
    )


def _get_order_or_pending_for_reference(order_number: str):
    try:
        return Order._default_manager.get(number=order_number), None
    except Order.DoesNotExist:
        reference = f"{settings.ORDER_PREFIX}{order_number}"
        pending = PendingCheckout.objects.filter(reference=reference).order_by(
            "-created_at", "-id"
        ).first()
        if pending is None:
            return None, None
        return None, pending


def _get_pending_checkout_total(pending) -> Decimal | None:
    snapshot = pending.basket_snapshot or {}
    total = snapshot.get("total")
    if total in (None, ""):
        return None

    try:
        return Decimal(str(total)) + Decimal(str(pending.donation or 0))
    except Exception:
        return None


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

        order, pending = _get_order_or_pending_for_reference(order_number)
        if order is None and pending is None:
            return Response(
                {"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # If already confirmed, short-circuit.
        # Pending checkouts have no order yet, so skip until one exists.
        if order and order.payment_events.filter(
            event_type__code__in=["paynow-auto-verified", "paynow-verified"]
        ).exists():
            return Response({"confirmed": True, "already_confirmed": True})

        # Build Gmail service
        try:
            service = build_gmail_service()
        except GmailClientError:
            return Response(
                {"detail": "PayNow email verification is not configured."},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        # Search for a recent email for this order
        max_age = int(getattr(settings, "GMAIL_MAX_AGE_MINUTES", 60) or 60)
        try:
            found = find_paynow_email_for_order(
                service,
                order_number=order.number if order else order_number,
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

        amount_str = found["amount"]
        received_at = found["received_at"]
        sender = found.get("from_email", "")

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

        if order is None:
            result = _place_order_from_pending(pending, amount)
            if result["error"]:
                return Response(
                    {
                        "confirmed": False,
                        "found": True,
                        "amount": amount_str,
                        "message": result["error"],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            order = result["order"]

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
        except PaymentConfirmationError:
            return Response(
                {
                    "confirmed": False,
                    "found": True,
                    "amount": amount_str,
                    "message": "Payment confirmation failed.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "confirmed": True,
                "found": True,
                "amount": amount_str,
                "sender": sender,
                "email_timestamp": received_at.isoformat(),
            }
        )


class PayNowGmailTestEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _is_localhost_request(request):
            return Response(
                {"detail": "This endpoint is only available on localhost."},
                status=status.HTTP_403_FORBIDDEN,
            )

        order_number = request.data.get("order") or request.data.get("order_number")
        if not order_number:
            return Response(
                {"detail": "order (order_number) is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order, pending = _get_order_or_pending_for_reference(order_number)
        if order is None and pending is None:
            return Response(
                {"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if order is not None:
            amount = order.total_incl_tax_with_donation
        else:
            amount = _get_pending_checkout_total(pending)
            if amount is None:
                return Response(
                    {
                        "detail": "Unable to determine pending checkout total for test email."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        to_email = (
            getattr(settings, "GMAIL_TEST_RECIPIENT", "")
            or getattr(settings, "SALES_EMAIL", "")
        )
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "")
        if not to_email or not from_email:
            return Response(
                {
                    "detail": "Set DEFAULT_FROM_EMAIL and either SALES_EMAIL or GMAIL_TEST_RECIPIENT to send test emails."
                },
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        send_mail(
            subject=PAYNOW_TEST_EMAIL_SUBJECT,
            message=_build_paynow_test_email_body(order_number, amount),
            from_email=from_email,
            recipient_list=[to_email],
            fail_silently=False,
        )

        return Response(
            {
                "sent": True,
                "order_number": order_number,
                "amount": f"{amount:.2f}",
                "recipient": to_email,
            }
        )
