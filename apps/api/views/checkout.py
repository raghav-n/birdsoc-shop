import os
import uuid
from decimal import Decimal
from django.conf import settings
from django.core.files.base import File, ContentFile
from django.core.files.storage import default_storage
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from oscar.core.loading import get_model, get_class
from apps.api.serializers import OrderSerializer
from apps.checkout.models import PendingCheckout


Basket = get_model("basket", "Basket")
Order = get_model("order", "Order")
Source = get_model("payment", "Source")
SourceType = get_model("payment", "SourceType")
DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
OrderTotalCalculator = get_class("checkout.calculators", "OrderTotalCalculator")
OrderPlacementMixin = get_class("checkout.mixins", "OrderPlacementMixin")
Selector = get_class("partner.strategy", "Selector")
Applicator = get_class("offer.applicator", "Applicator")


class PayNowProofUploadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        basket_id = request.data.get("basket_id")
        donation = request.data.get("donation")
        try:
            donation = int(donation) if donation is not None else 0
        except Exception:
            return Response(
                {"detail": "donation must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not basket_id:
            return Response(
                {"detail": "basket_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            basket = Basket._default_manager.get(id=basket_id)
        except Basket.DoesNotExist:
            return Response(
                {"detail": "Basket not found"}, status=status.HTTP_404_NOT_FOUND
            )

        upload = request.FILES.get("payment_proof")
        if not upload:
            return Response(
                {"detail": "payment_proof file is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save to a temporary path; will be moved onto Source during place-order
        ext = os.path.splitext(upload.name)[1]
        temp_name = f"payments/temp/{uuid.uuid4()}{ext}"
        saved_path = default_storage.save(temp_name, upload)

        reference = (
            f"{settings.ORDER_PREFIX}{settings.BASE_ORDER_NUMBER + int(basket.id)}"
        )
        cache_key = f"paynow-proof:{basket.id}"
        cache.set(
            cache_key,
            {"path": saved_path, "donation": donation, "reference": reference},
            timeout=2 * 60 * 60,
        )

        return Response(
            {
                "reference": reference,
                "donation": donation,
                "temp_key": cache_key,
            },
            status=status.HTTP_201_CREATED,
        )


class CheckoutEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        basket_id = request.data.get("basket_id")
        email = (request.data.get("email") or "").strip()
        if not basket_id or not email:
            return Response(
                {"detail": "basket_id and email are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Basic format validation without strict enforcement
        if "@" not in email:
            return Response(
                {"detail": "Invalid email"}, status=status.HTTP_400_BAD_REQUEST
            )
        cache.set(f"guest-email:{basket_id}", email, timeout=2 * 60 * 60)
        return Response({"saved": True})


class CheckoutAddressView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        basket_id = request.data.get("basket_id")
        address = request.data.get("address")
        if not basket_id or not isinstance(address, dict):
            return Response(
                {"detail": "basket_id and address object are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cache.set(f"shipping-address:{basket_id}", address, timeout=2 * 60 * 60)
        return Response({"saved": True})


class SavePendingCheckoutView(APIView):
    """Save checkout intent when the user reaches the payment step.

    If the user makes a PayNow transfer but closes the browser before
    uploading proof, this record survives so admins can follow up.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        basket_id = request.data.get("basket_id")
        if not basket_id:
            return Response(
                {"detail": "basket_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            basket = Basket._default_manager.get(id=basket_id)
        except Basket.DoesNotExist:
            return Response(
                {"detail": "Basket not found"}, status=status.HTTP_404_NOT_FOUND
            )

        reference = (
            f"{settings.ORDER_PREFIX}{settings.BASE_ORDER_NUMBER + int(basket.id)}"
        )
        email = (
            request.data.get("email")
            or cache.get(f"guest-email:{basket.id}")
            or ""
        )
        donation = request.data.get("donation", 0)
        try:
            donation = int(donation) if donation is not None else 0
        except Exception:
            donation = 0

        # Store the basket snapshot as sent by the frontend (already has
        # the final computed values including vouchers, offers, shipping).
        basket_snapshot = request.data.get("basket_snapshot", {})

        PendingCheckout.objects.create(
            basket_id=basket.id,
            email=email,
            reference=reference,
            shipping_method_code=request.data.get("shipping_method_code", ""),
            donation=donation,
            basket_snapshot=basket_snapshot,
        )

        return Response({"saved": True, "reference": reference})


class PlaceOrderView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        basket_id = request.data.get("basket_id")
        if not basket_id:
            return Response(
                {"detail": "basket_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            basket = Basket._default_manager.get(id=basket_id)
        except Basket.DoesNotExist:
            return Response(
                {"detail": "Basket not found"}, status=status.HTTP_404_NOT_FOUND
            )

        basket.strategy = Selector().strategy(request=request)
        Applicator().apply(basket, request.user, request)

        if basket.is_empty:
            return Response(
                {"detail": "Basket is empty"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Load PayNow temp upload info either via temp_key or new upload
        temp_key = request.data.get("temp_key")
        donation = request.data.get("donation")
        try:
            donation = int(donation) if donation is not None else None
        except Exception:
            return Response(
                {"detail": "donation must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_file_path = None
        reference = None
        if temp_key:
            cached = cache.get(temp_key)
            if not cached:
                return Response(
                    {"detail": "Invalid or expired temp_key"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payment_file_path = cached.get("path")
            reference = cached.get("reference")
            if donation is None:
                donation = cached.get("donation", 0)
        else:
            upload = request.FILES.get("payment_proof")
            if upload:
                ext = os.path.splitext(upload.name)[1]
                temp_name = f"payments/temp/{uuid.uuid4()}{ext}"
                payment_file_path = default_storage.save(temp_name, upload)
            reference = (
                f"{settings.ORDER_PREFIX}{settings.BASE_ORDER_NUMBER + int(basket.id)}"
            )
            if donation is None:
                donation = 0

        # Determine shipping method
        code = request.data.get("shipping_method_code")
        qs = DynamicShippingMethod._default_manager.filter(
            active=True, available_to_public=True
        )
        if code:
            method = qs.filter(code=code).first()
            if not method:
                return Response(
                    {"detail": "Invalid shipping_method_code"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if settings.GLOBAL_SELF_COLLECTION_REQUIRED:
                method = qs.filter(is_self_collect=True).first()
            else:
                method = qs.first()
            if not method:
                return Response(
                    {"detail": "No shipping method available"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Calculate shipping and order totals (donation added at source/event level)
        shipping_charge = method.calculate(basket)
        order_total = OrderTotalCalculator(request=request).calculate(
            basket, shipping_charge
        )

        # Compute amount debited
        if donation is None:
            donation = 0
        total_with_donation = (order_total.incl_tax or order_total.excl_tax) + Decimal(
            donation
        )

        # Place order using OrderPlacementMixin
        class ApiOrderPlacer(OrderPlacementMixin):
            def __init__(self, request):
                self.request = request

        placer = ApiOrderPlacer(request)

        if payment_file_path:
            # Prepare payment source with PayNow reference and proof
            source_type, _ = SourceType._default_manager.get_or_create(name="PayNow")
            order_payment_source = Source(source_type=source_type)
            order_payment_source.reference = reference
            try:
                filename = os.path.basename(payment_file_path)
                with default_storage.open(payment_file_path, "rb") as fh:
                    content = fh.read()
                order_payment_source.payment_proof.save(
                    filename, ContentFile(content), save=False
                )
            except Exception:
                return Response(
                    {"detail": "Unable to read payment proof"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            order_payment_source.amount_debited = total_with_donation
            placer.add_payment_source(order_payment_source)
            placer.add_payment_event(
                "paynow-processing", total_with_donation, reference=reference
            )
        elif total_with_donation > 0:
            return Response(
                {"detail": "Payment proof is required for non-zero orders"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order_number = placer.generate_order_number(basket)
            order = placer.place_order(
                order_number=order_number,
                user=request.user if request.user.is_authenticated else None,
                basket=basket,
                shipping_address=None,
                shipping_method=method,
                shipping_charge=shipping_charge,
                order_total=order_total,
                billing_address=None,
                donation_amount=donation,
                guest_email=(
                    request.data.get("email")
                    or cache.get(f"guest-email:{basket.id}")
                    or ""
                ),
                request=request,
            )
            basket.submit()
            # Clean up pending checkout record
            PendingCheckout.objects.filter(basket_id=basket.id).delete()
        except Exception as e:
            return Response(
                {"detail": f"Unable to place order: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        finally:
            # Clean up temp file if any
            try:
                if payment_file_path and payment_file_path.startswith("payments/temp/"):
                    default_storage.delete(payment_file_path)
            except Exception:
                pass

        data = OrderSerializer(order).data
        return Response(data, status=status.HTTP_201_CREATED)
