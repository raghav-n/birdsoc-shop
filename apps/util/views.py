from decimal import Decimal
import sys

from django.db import OperationalError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from sentry_sdk import last_event_id

import json
import jwt
import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.shortcuts import get_object_or_404
from oscar.core.loading import get_model, get_class
from apps.util.payments import confirm_paynow_payment, PaymentConfirmationError

JWT_SECRET = settings.JWT_SECRET

Order = get_model("order", "Order")
PaymentEvent = get_model("order", "PaymentEvent")
PaymentEventQuantity = get_model("order", "PaymentEventQuantity")
PaymentEventType = get_model("order", "PaymentEventType")
InvalidOrderStatus = get_class("order.exceptions", "InvalidOrderStatus")


def handler500(request: HttpRequest, *args, **argv) -> HttpResponse:
    """
    Custom 500 error handler.
    """
    type_, value, traceback = sys.exc_info()
    traffic = False

    if isinstance(value, OperationalError):
        traffic = True

    return render(
        request,
        "500.html",
        {
            "sentry_event_id": last_event_id(),
            "traffic": traffic,
        },
        status=500,
    )


def handler404(request: HttpRequest, *args, **argv) -> HttpResponse:
    """
    Custom 404 error handler.
    """
    return render(request, "404.html", status=404)


def verify_jwt(token):
    """Verify JWT using PyJWT"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token expired
    except jwt.InvalidTokenError:
        return None  # Invalid token


@csrf_exempt
def verify_payment(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method"}, status=405)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JsonResponse({"error": "Unauthorized"}, status=401)

    token = auth_header.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        return JsonResponse({"error": "Invalid or expired token"}, status=401)

    order_number = payload.get("order_number")
    amount = payload.get("amount")

    print(
        f"Received payment verification for order {order_number} with amount {amount}"
    )

    if not order_number or not amount:
        return JsonResponse({"error": "Invalid payload"}, status=400)

    try:
        order = Order._default_manager.get(number=order_number)
    except Order.DoesNotExist:
        return JsonResponse({"error": f"Order {order_number} not found"}, status=404)

    # Store payment confirmation with the amount
    try:
        # If already confirmed, report as error for webhook duplication
        if order.payment_events.filter(
            event_type__code__in=["paynow-auto-verified", "paynow-verified"]
        ).exists():
            return JsonResponse(
                {"error": f"Order {order_number} already marked as paid."}, status=400
            )

        confirm_paynow_payment(order, Decimal(amount))

    except PaymentConfirmationError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except InvalidOrderStatus as e:
        return JsonResponse(
            {"error": f"Failed to confirm payment: {str(e)}"}, status=500
        )

    return JsonResponse(
        {"success": f"Order {order_number} marked as paid. Amount: SGD {amount}."}
    )
