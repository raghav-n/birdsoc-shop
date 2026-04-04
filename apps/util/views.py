from decimal import Decimal
import sys

from django.db import OperationalError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from sentry_sdk import last_event_id

import json
import jwt
import datetime
from django.core.mail import mail_admins
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.shortcuts import get_object_or_404
from oscar.core.loading import get_model, get_class
from apps.util.payments import confirm_paynow_payment, PaymentConfirmationError
from apps.checkout.models import PendingCheckout

JWT_SECRET = settings.JWT_SECRET

Order = get_model("order", "Order")
Basket = get_model("basket", "Basket")
Source = get_model("payment", "Source")
SourceType = get_model("payment", "SourceType")
DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
PaymentEvent = get_model("order", "PaymentEvent")
PaymentEventQuantity = get_model("order", "PaymentEventQuantity")
PaymentEventType = get_model("order", "PaymentEventType")
InvalidOrderStatus = get_class("order.exceptions", "InvalidOrderStatus")
OrderTotalCalculator = get_class("checkout.calculators", "OrderTotalCalculator")
OrderPlacementMixin = get_class("checkout.mixins", "OrderPlacementMixin")
Selector = get_class("partner.strategy", "Selector")


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


def _place_order_from_pending(pending, amount):
    """Create an order from a PendingCheckout record.

    Called when the payment webhook fires but no order has been placed yet
    (user made payment then left before uploading proof / pressing submit).
    The order is created *without* a payment proof image.

    Returns ``{"order": <Order>, "error": None}`` on success, or
    ``{"order": None, "error": "..."}`` on failure.
    """
    from django.core.cache import cache

    try:
        basket = Basket._default_manager.get(id=pending.basket_id)
    except Basket.DoesNotExist:
        return {"order": None, "error": "Basket no longer exists"}

    basket.strategy = Selector().strategy()

    if basket.is_empty:
        # Basket lines may have been deleted (e.g. stock hit 0 while user was on
        # the payment screen). Try to restore them from the snapshot saved at
        # checkout time.
        snapshot = pending.basket_snapshot or {}
        snapshot_lines = snapshot.get("lines", [])
        restored = 0
        for entry in snapshot_lines:
            product_id = entry.get("product_id")
            stockrecord_id = entry.get("stockrecord_id")
            quantity = entry.get("quantity", 1)
            if not product_id or not stockrecord_id:
                continue
            try:
                from oscar.core.loading import get_model as _get_model
                Product = _get_model("catalogue", "Product")
                StockRecord = _get_model("partner", "StockRecord")
                product = Product._default_manager.get(id=product_id)
                stockrecord = StockRecord._default_manager.get(id=stockrecord_id)
                basket.lines.create(
                    line_reference=f"{product_id}_{stockrecord_id}",
                    product=product,
                    stockrecord=stockrecord,
                    quantity=quantity,
                    price_currency=stockrecord.price_currency,
                    price_excl_tax=stockrecord.price,
                    price_incl_tax=stockrecord.price,
                )
                restored += 1
            except Exception:
                continue
        # Invalidate the cached lines so the freshly-added ones are picked up
        basket._lines = None
        basket.strategy = Selector().strategy()
        if basket.is_empty:
            return {"order": None, "error": "Basket is empty and could not be restored from snapshot"}

    # Resolve shipping method
    qs = DynamicShippingMethod._default_manager.filter(
        active=True, available_to_public=True
    )
    method = None
    if pending.shipping_method_code:
        method = qs.filter(code=pending.shipping_method_code).first()
    if not method:
        if settings.GLOBAL_SELF_COLLECTION_REQUIRED:
            method = qs.filter(is_self_collect=True).first()
        else:
            method = qs.first()
    if not method:
        return {"order": None, "error": "No shipping method available"}

    shipping_charge = method.calculate(basket)
    order_total = OrderTotalCalculator().calculate(basket, shipping_charge)

    donation = pending.donation or 0
    reference = pending.reference
    total_with_donation = (
        order_total.incl_tax or order_total.excl_tax
    ) + Decimal(donation)

    # Create payment source (no proof file)
    source_type, _ = SourceType._default_manager.get_or_create(name="PayNow")
    payment_source = Source(
        source_type=source_type,
        reference=reference,
        amount_debited=total_with_donation,
    )

    class _Placer(OrderPlacementMixin):
        def __init__(self):
            self.request = None

    placer = _Placer()
    placer.add_payment_source(payment_source)
    placer.add_payment_event(
        "paynow-processing", total_with_donation, reference=reference
    )

    try:
        order_number = placer.generate_order_number(basket)
        guest_email = pending.email or cache.get(f"guest-email:{basket.id}") or ""
        order = placer.place_order(
            order_number=order_number,
            user=basket.owner,
            basket=basket,
            shipping_address=None,
            shipping_method=method,
            shipping_charge=shipping_charge,
            order_total=order_total,
            billing_address=None,
            donation_amount=donation,
            guest_email=guest_email,
        )
        basket.submit()
        PendingCheckout.objects.filter(basket_id=pending.basket_id).delete()
    except Exception as e:
        return {"order": None, "error": f"Unable to place order: {e}"}

    return {"order": order, "error": None}


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
        # No placed order yet — check for a pending checkout
        reference = f"{settings.ORDER_PREFIX}{order_number}"
        pending = PendingCheckout.objects.filter(reference=reference).first()
        if pending is None:
            try:
                mail_admins(
                    subject=f"Unmatched payment received: {order_number}",
                    message=(
                        f"A payment webhook was received that could not be matched "
                        f"to any order or pending checkout.\n\n"
                        f"Reference / order number: {order_number}\n"
                        f"Amount: SGD {amount}\n\n"
                        f"This may indicate the customer entered an incorrect "
                        f"reference when making their PayNow transfer.\n\n"
                        f"Please check the pending checkouts dashboard for "
                        f"recent records that may correspond to this payment."
                    ),
                )
            except Exception:
                pass  # Don't let email failure block the webhook response
            return JsonResponse(
                {"error": f"Order {order_number} not found"}, status=404
            )

        # Try to place the order from the pending checkout
        result = _place_order_from_pending(pending, Decimal(amount))
        if result["error"]:
            return JsonResponse({"error": result["error"]}, status=400)
        order = result["order"]

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


@csrf_exempt
def verify_event_payment(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid request method"}, status=405)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JsonResponse({"error": "Unauthorized"}, status=401)

    token = auth_header.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        return JsonResponse({"error": "Invalid or expired token"}, status=401)

    registration_id = payload.get("registration_id")
    reference = payload.get("reference")
    group_id = payload.get("group_id")
    group_reference = payload.get("group_reference")
    amount = payload.get("amount")

    if not amount:
        return JsonResponse({"error": "Invalid payload"}, status=400)

    # Disallow ambiguous requests: either a single registration or a group, not both
    reg_keys = bool(registration_id or reference)
    grp_keys = bool(group_id or group_reference)
    if not reg_keys and not grp_keys:
        return JsonResponse(
            {
                "error": "Must provide registration_id/reference or group_id/group_reference"
            },
            status=400,
        )
    if reg_keys and grp_keys:
        return JsonResponse(
            {"error": "Provide either registration fields or group fields, not both"},
            status=400,
        )

    from oscar.core.loading import get_model

    EventRegistration = get_model("event", "EventRegistration")
    EventRegistrationGroup = get_model("event", "EventRegistrationGroup")

    from decimal import Decimal

    try:
        amt = Decimal(str(amount))
    except Exception:
        return JsonResponse({"error": "Invalid amount format"}, status=400)

    # Group verification path
    if grp_keys:
        try:
            if group_id:
                grp = EventRegistrationGroup._default_manager.get(id=group_id)
            else:
                grp = EventRegistrationGroup._default_manager.get(
                    reference=group_reference
                )
        except EventRegistrationGroup.DoesNotExist:
            return JsonResponse({"error": "Group not found"}, status=404)

        if grp.payment_verified:
            return JsonResponse({"error": "Group already marked as paid."}, status=400)

        if (grp.amount_total + (grp.donation_amount or Decimal("0"))) != amt:
            return JsonResponse(
                {
                    "error": f"Amount mismatch. Expected SGD {grp.amount_total + (grp.donation_amount or Decimal('0'))}"
                },
                status=400,
            )

        grp.verify(user=None)
        return JsonResponse(
            {"success": f"Event registration group {grp.id} marked as paid."}
        )

    # Single registration verification path
    try:
        if registration_id:
            reg = EventRegistration._default_manager.get(id=registration_id)
        else:
            reg = EventRegistration._default_manager.get(reference=reference)
    except EventRegistration.DoesNotExist:
        return JsonResponse({"error": "Registration not found"}, status=404)

    if reg.payment_verified:
        return JsonResponse(
            {"error": "Registration already marked as paid."}, status=400
        )

    if (reg.amount + (reg.donation_amount or Decimal("0"))) != amt:
        return JsonResponse(
            {
                "error": f"Amount mismatch. Expected SGD {reg.amount + (reg.donation_amount or Decimal('0'))}"
            },
            status=400,
        )

    reg.verify(user=None)
    return JsonResponse({"success": f"Event registration {reg.id} marked as paid."})
