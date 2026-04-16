"""
Staff-only API views for onsite purchase flow.

Follows the same order number generation and business logic as
apps/dashboard/orders/views.py OnsitePurchaseView, adapted for
the React frontend (JWT auth, JSON I/O).
"""
import traceback
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import get_random_string
from oscar.apps.voucher.models import Voucher
from oscar.core.loading import get_class, get_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.checkout.models import PendingCheckout
from apps.checkout.onsite_users import get_or_create_onsite_customer_user

Product = get_model("catalogue", "Product")
Basket = get_model("basket", "Basket")
Order = get_model("order", "Order")
Source = get_model("payment", "Source")
SourceType = get_model("payment", "SourceType")
DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
PaymentEvent = get_model("order", "PaymentEvent")
PaymentEventType = get_model("order", "PaymentEventType")
PaymentEventQuantity = get_model("order", "PaymentEventQuantity")
OrderCreator = get_class("order.utils", "OrderCreator")
Selector = get_class("partner.strategy", "Selector")
Applicator = get_class("offer.applicator", "Applicator")
ConditionalOffer = get_model("offer", "ConditionalOffer")
OrderTotalCalculator = get_class("checkout.calculators", "OrderTotalCalculator")
def _generate_onsite_order_number():
    """Generate unique onsite order number starting with '2', matching the Django dashboard approach."""
    for _ in range(10):
        candidate = "2" + get_random_string(
            length=5, allowed_chars="0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        )
        if not Order.objects.filter(number=candidate).exists() and not PendingCheckout.objects.filter(
            reference=f"{settings.ORDER_PREFIX}{candidate}"
        ).exists():
            return candidate
    # Fallback to timestamp
    return f"2{timezone.now().strftime('%y%m%d%H%M%S')[-5:]}"


def _build_unsaved_basket(products_data, strategy, user=None):
    """Create an unsaved in-memory basket with products for discount calculation."""
    basket = Basket()
    basket.strategy = strategy
    if user:
        basket.owner = user
    for item in products_data:
        try:
            product_id = item.get("id")
            quantity = int(item.get("quantity", 0))
            if quantity <= 0:
                continue
            product = Product.objects.get(id=product_id)
            basket.add_product(product, quantity=quantity)
        except (Product.DoesNotExist, ValueError, TypeError, KeyError):
            continue
    return basket


def _create_onsite_guest_user():
    """Reuse one canonical onsite user for onsite sales."""
    guest_user, _created = get_or_create_onsite_customer_user()
    return guest_user


def _resolve_onsite_shipping_method():
    """Use the dedicated ONSITE shipping method, or a self-collect fallback."""
    try:
        return DynamicShippingMethod.objects.get(code="ONSITE")
    except DynamicShippingMethod.DoesNotExist:
        return DynamicShippingMethod.objects.filter(is_self_collect=True).first()


def _build_persisted_onsite_basket(products_data, request):
    """Create a persisted basket for onsite payment/pending flows."""
    guest_user = _create_onsite_guest_user()
    basket = Basket.objects.create(owner=guest_user)
    strategy = Selector().strategy(request=request)
    basket.strategy = strategy

    stock_updates = []
    for item in products_data:
        try:
            product_id = item.get("id")
            quantity = int(item.get("quantity", 0))
        except (TypeError, ValueError):
            continue
        if quantity <= 0:
            continue

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            raise ValueError(f"Product {product_id} not found")

        stockrecord = product.stockrecords.first()
        if (
            stockrecord
            and stockrecord.num_in_stock is not None
            and stockrecord.num_in_stock < quantity
        ):
            raise ValueError(
                f"Not enough stock for {product.title}. Available: {stockrecord.num_in_stock}"
            )
        if stockrecord:
            stock_updates.append((stockrecord, quantity))

        basket.add_product(product, quantity=quantity)

    if basket.is_empty:
        raise ValueError("Basket is empty")

    return guest_user, basket, stock_updates


def _build_pending_snapshot(basket, order_total, shipping_charge, order_number):
    discounts = basket.offer_applications.offer_discounts or []
    return {
        "lines": [
            {
                "product_id": line.product_id,
                "stockrecord_id": line.stockrecord_id,
                "title": line.product.title,
                "quantity": line.quantity,
                "price": str(
                    getattr(line, "line_price_incl_tax", None)
                    or getattr(line, "line_price_excl_tax", None)
                    or getattr(line, "unit_price_incl_tax", None)
                    or Decimal("0.00")
                ),
            }
            for line in basket.all_lines()
        ],
        "discounts": [
            {
                "name": discount.get("name") or "Discount",
                "amount": str(discount.get("discount", 0)),
            }
            for discount in discounts
        ],
        "shipping": str(shipping_charge.incl_tax if shipping_charge else Decimal("0.00")),
        "total": str(order_total.incl_tax),
        "order_number": order_number,
        "onsite_purchase": True,
    }


class OnsiteCalculateView(APIView):
    """Calculate pricing with auto-applied offers and optional voucher.

    Used for live price preview while building the cart.
    Does not persist anything.
    """

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        products_data = request.data.get("products", [])
        voucher_code = (request.data.get("voucher_code") or "").strip()

        if not products_data:
            return Response({
                "subtotal": "0.00",
                "offers_discount": "0.00",
                "offers_description": "",
                "voucher_discount": "0.00",
                "voucher_error": None,
                "total": "0.00",
            })

        strategy = Selector().strategy(request=request)
        basket = _build_unsaved_basket(products_data, strategy)

        if not basket.num_lines:
            return Response({
                "subtotal": "0.00",
                "offers_discount": "0.00",
                "offers_description": "",
                "voucher_discount": "0.00",
                "voucher_error": None,
                "total": "0.00",
            })

        original_total = basket.total_excl_tax

        # Apply all site offers
        applicator = Applicator()
        applicator.apply(basket, request.user, request)

        total_after_offers = basket.total_excl_tax
        offers_discount = max(Decimal("0.00"), original_total - total_after_offers)

        offers = [
            {"name": d["name"] or "Discount", "amount": str(d["discount"])}
            for d in basket.offer_applications.offer_discounts
            if d.get("discount", 0)
        ]
        offers_description = ", ".join(o["name"] for o in offers)

        # Apply voucher on a fresh basket (stacked on top of site offers)
        voucher_discount = Decimal("0.00")
        voucher_error = None

        if voucher_code:
            try:
                voucher = Voucher.objects.get(code__iexact=voucher_code)
                is_available, message = voucher.is_available_to_user(user=request.user)
                if not is_available:
                    voucher_error = message or "Voucher is not available"
                else:
                    v_basket = _build_unsaved_basket(products_data, strategy)
                    v_basket.vouchers.add(voucher)
                    Applicator().apply(v_basket, request.user, request)
                    total_after_voucher = v_basket.total_excl_tax
                    voucher_discount = max(Decimal("0.00"), total_after_offers - total_after_voucher)
            except Voucher.DoesNotExist:
                voucher_error = "Voucher code not found"
            except Exception:
                voucher_error = "Unable to apply voucher"

        total = max(Decimal("0.00"), total_after_offers - voucher_discount)

        # Clean up any temporary baskets that Oscar saved during add_product
        for b in [basket, locals().get("v_basket")]:
            if b is not None and b.pk:
                b.delete()

        return Response({
            "subtotal": str(original_total),
            "offers": offers,
            "offers_discount": str(offers_discount),
            "offers_description": offers_description,
            "voucher_discount": str(voucher_discount),
            "voucher_error": voucher_error,
            "total": str(total),
        })


class OnsitePendingView(APIView):
    """Prepare an onsite payment by creating a pending checkout without placing the order."""

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        products_data = request.data.get("products", [])
        voucher_code = (request.data.get("voucher_code") or "").strip()

        if not products_data:
            return Response(
                {"detail": "products list is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                guest_user, basket, _stock_updates = _build_persisted_onsite_basket(
                    products_data, request
                )

                if voucher_code:
                    try:
                        voucher = Voucher.objects.get(code__iexact=voucher_code)
                        basket.vouchers.add(voucher)
                    except Voucher.DoesNotExist:
                        return Response(
                            {"detail": "Voucher code not found"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                Applicator().apply(basket, request.user, request)

                shipping_method = _resolve_onsite_shipping_method()
                if not shipping_method:
                    return Response(
                        {"detail": "No ONSITE shipping method configured"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                shipping_charge = shipping_method.calculate(basket)
                order_total = OrderTotalCalculator().calculate(basket, shipping_charge)
                order_number = _generate_onsite_order_number()
                reference = f"{settings.ORDER_PREFIX}{order_number}"

                PendingCheckout.objects.create(
                    basket_id=basket.id,
                    email="",
                    reference=reference,
                    shipping_method_code=shipping_method.code,
                    donation=0,
                    basket_snapshot=_build_pending_snapshot(
                        basket=basket,
                        order_total=order_total,
                        shipping_charge=shipping_charge,
                        order_number=order_number,
                    ),
                )

        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            traceback.print_exc()
            return Response(
                {"detail": f"Unable to prepare payment: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "order_number": order_number,
                "reference": reference,
                "total": str(order_total.incl_tax),
                "pending": True,
            },
            status=status.HTTP_201_CREATED,
        )


class OnsiteOrderView(APIView):
    """Place an onsite order and return the order number + reference for QR + Gmail polling.

    Follows the same approach as OnsitePurchaseView in the Oscar dashboard:
    - Order number starts with '2' + 5 random alphanumeric chars
    - Uses the ONSITE shipping method
    - Creates a guest user for the order
    - Sets up paynow-processing payment event for Gmail polling
    - Initial status is OSCAR_INITIAL_ORDER_STATUS (not COLLECTED_STATUS),
      so Gmail polling can auto-confirm via confirm_paynow_payment().
    """

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        products_data = request.data.get("products", [])
        voucher_code = (request.data.get("voucher_code") or "").strip()

        if not products_data:
            return Response(
                {"detail": "products list is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                guest_user, basket, stock_updates = _build_persisted_onsite_basket(
                    products_data, request
                )

                # Apply voucher if provided
                voucher = None
                if voucher_code:
                    try:
                        voucher = Voucher.objects.get(code__iexact=voucher_code)
                        basket.vouchers.add(voucher)
                    except Voucher.DoesNotExist:
                        return Response(
                            {"detail": "Voucher code not found"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                # Apply all offers (site offers + voucher)
                Applicator().apply(basket, request.user, request)

                # Use ONSITE shipping method (same as OnsitePurchaseView)
                shipping_method = _resolve_onsite_shipping_method()
                if not shipping_method:
                    return Response(
                        {"detail": "No ONSITE shipping method configured"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                shipping_charge = shipping_method.calculate(basket)
                order_total = OrderTotalCalculator().calculate(basket, shipping_charge)

                # Generate onsite order number (starts with '2')
                order_number = _generate_onsite_order_number()
                reference = f"{settings.ORDER_PREFIX}{order_number}"

                # Place order using OrderCreator (same as OnsitePurchaseView)
                # Use initial status so Gmail polling can auto-confirm
                order = OrderCreator().place_order(
                    basket=basket,
                    total=order_total,
                    shipping_method=shipping_method,
                    shipping_charge=shipping_charge,
                    user=guest_user,
                    order_number=order_number,
                    status=settings.OSCAR_INITIAL_ORDER_STATUS,
                )

                # Record voucher usage
                if voucher:
                    voucher.record_usage(order, request.user)

                # Create PayNow payment source
                source_type, _ = SourceType.objects.get_or_create(name="PayNow")
                Source.objects.create(
                    source_type=source_type,
                    amount_allocated=order_total.incl_tax,
                    amount_debited=order_total.incl_tax,
                    reference=reference,
                    order=order,
                )

                # Create paynow-processing event (required for Gmail polling)
                event_type, _ = PaymentEventType.objects.get_or_create(
                    name="paynow-processing",
                    defaults={"code": "paynow-processing"},
                )
                event = PaymentEvent.objects.create(
                    event_type=event_type,
                    amount=order_total.incl_tax,
                    reference=reference,
                    order=order,
                )
                for line in order.lines.all():
                    PaymentEventQuantity.objects.create(
                        event=event, line=line, quantity=line.quantity
                    )

                # Decrement stock (same as OnsitePurchaseView)
                for stockrecord, quantity in stock_updates:
                    if stockrecord.num_in_stock is not None:
                        stockrecord.num_in_stock -= quantity
                        stockrecord.save()

        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            traceback.print_exc()
            return Response(
                {"detail": f"Order placement failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "order_number": order_number,
                "reference": reference,
                "total": str(order_total.incl_tax),
            },
            status=status.HTTP_201_CREATED,
        )
