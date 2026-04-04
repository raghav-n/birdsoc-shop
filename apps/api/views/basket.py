from typing import Optional

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from oscar.core.loading import get_model, get_class

from apps.api.serializers import BasketSerializer, BasketLineSerializer


Basket = get_model("basket", "Basket")
Line = get_model("basket", "Line")


class StaleBasketError(Exception):
    pass
Product = get_model("catalogue", "Product")
Voucher = get_model("voucher", "Voucher")
Selector = get_class("partner.strategy", "Selector")
Applicator = get_class("offer.applicator", "Applicator")


def _get_request_strategy(request):
    return get_class("partner.strategy", "Selector")().strategy(request=request)


def _serialize_basket(basket, request):
    if not basket.is_empty:
        # Remove lines whose product is no longer available (not public or out of stock)
        for line in list(basket.all_lines()):
            product = line.product
            if product is None:
                line.delete()
                continue
            # Resolve to parent for public check (child products don't have is_public)
            root = product.parent if getattr(product, 'parent_id', None) else product
            if not root.is_public:
                line.delete()
                continue
            sr = product.stockrecords.first()
            if sr is None or sr.net_stock_level <= 0:
                line.delete()
        Applicator().apply(basket, request.user, request)
    serializer = BasketSerializer(basket, context={"request": request})
    return serializer.data


def _find_user_basket(user) -> Optional[Basket]:
    if not user or not user.is_authenticated:
        return None
    try:
        return (
            Basket._default_manager.filter(owner=user, status=Basket.OPEN)
            .order_by("-date_created")
            .first()
        )
    except Exception:
        return (
            Basket._default_manager.filter(owner=user, status="Open")
            .order_by("-date_created")
            .first()
        )


def _find_guest_basket(cart_id: Optional[str]) -> Optional[Basket]:
    if not cart_id:
        return None
    try:
        return Basket._default_manager.filter(id=cart_id, status=Basket.OPEN).first()
    except Exception:
        return Basket._default_manager.filter(id=cart_id, status="Open").first()


class BasketCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        owner = request.user if request.user.is_authenticated else None
        basket = Basket._default_manager.create(owner=owner, status="Open")
        basket.strategy = _get_request_strategy(request)
        return Response(
            {"cart_id": basket.id, "basket": _serialize_basket(basket, request)},
            status=status.HTTP_201_CREATED,
        )


class BasketCurrentView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user_basket = _find_user_basket(request.user)
        if user_basket:
            user_basket.strategy = _get_request_strategy(request)
            return Response(_serialize_basket(user_basket, request))

        cart_id = request.headers.get("X-Cart-Id") or request.query_params.get(
            "cart_id"
        )
        guest_basket = _find_guest_basket(cart_id)
        if not guest_basket:
            return Response(
                {"detail": "Basket not found"}, status=status.HTTP_404_NOT_FOUND
            )
        guest_basket.strategy = _get_request_strategy(request)
        return Response(_serialize_basket(guest_basket, request))


class BasketLinesView(APIView):
    permission_classes = [permissions.AllowAny]

    def _get_basket(self, request, basket_id) -> Basket:
        basket = Basket._default_manager.filter(id=basket_id).first()
        if not basket:
            raise ValueError("Basket does not exist")
        # Owner check (if claimed)
        if (
            basket.owner_id
            and request.user.is_authenticated
            and basket.owner_id != request.user.id
        ):
            raise PermissionError("Forbidden")
        if not basket.can_be_edited:
            raise StaleBasketError("Basket is no longer active")
        basket.strategy = _get_request_strategy(request)
        return basket

    def post(self, request, basket_id: str):
        try:
            basket = self._get_basket(request, basket_id)
        except PermissionError:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        except StaleBasketError:
            return Response({"detail": "stale_basket"}, status=status.HTTP_410_GONE)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)

        product_id = request.data.get("product_id")
        quantity = int(request.data.get("quantity", 1))
        if not product_id:
            return Response(
                {"detail": "product_id required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            product = Product._default_manager.get(pk=product_id)
        except Product.DoesNotExist:
            return Response(
                {"detail": "Product not found"}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            basket.add_product(product, quantity=quantity, options=[])
        except Exception as e:
            return Response(
                {"detail": f"Cannot add to basket: {e}"},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = BasketSerializer(basket, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BasketLineDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def _get_line(self, request, basket_id, line_id) -> Line:
        line = Line._default_manager.filter(id=line_id, basket_id=basket_id).first()
        if not line:
            raise ValueError("Line does not exist")
        if (
            line.basket.owner_id
            and request.user.is_authenticated
            and line.basket.owner_id != request.user.id
        ):
            raise PermissionError("Forbidden")
        if not line.basket.can_be_edited:
            raise StaleBasketError("Basket is no longer active")
        line.basket.strategy = _get_request_strategy(request)
        return line

    def patch(self, request, basket_id: str, line_id: str):
        try:
            line = self._get_line(request, basket_id, line_id)
        except PermissionError:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        except StaleBasketError:
            return Response({"detail": "stale_basket"}, status=status.HTTP_410_GONE)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)

        try:
            qty = int(request.data.get("quantity"))
        except Exception:
            return Response(
                {"detail": "quantity must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if qty <= 0:
            line.delete()
        else:
            line.quantity = qty
            line.save()
        basket = line.basket
        serializer = BasketSerializer(basket, context={"request": request})
        return Response(serializer.data)

    def delete(self, request, basket_id: str, line_id: str):
        try:
            line = self._get_line(request, basket_id, line_id)
        except PermissionError:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        except StaleBasketError:
            return Response({"detail": "stale_basket"}, status=status.HTTP_410_GONE)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        basket = line.basket
        line.delete()
        serializer = BasketSerializer(basket, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class BasketApplyVoucherView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, basket_id: str):
        code = (request.data.get("code") or "").strip()
        if not code:
            return Response(
                {"detail": "Voucher code is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        basket = Basket._default_manager.filter(id=basket_id).first()
        if not basket:
            return Response(
                {"detail": "Basket not found"}, status=status.HTTP_404_NOT_FOUND
            )
        if (
            basket.owner_id
            and request.user.is_authenticated
            and basket.owner_id != request.user.id
        ):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        try:
            voucher = Voucher._default_manager.get(code__iexact=code)
        except Voucher.DoesNotExist:
            return Response(
                {"detail": "Invalid voucher code"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Vouchers require an authenticated user (Oscar enforces this)
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Please log in to apply a voucher", "requires_login": True},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check availability
        available, message = voucher.is_available_to_user(user=request.user)
        if not available:
            return Response(
                {"detail": message or "Voucher unavailable"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        basket.vouchers.add(voucher)
        basket.strategy = _get_request_strategy(request)
        return Response(_serialize_basket(basket, request))


class BasketMergeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        source_cart_id = request.data.get("source_cart_id")
        if not source_cart_id:
            return Response(
                {"detail": "source_cart_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        source = _find_guest_basket(source_cart_id)
        if not source:
            return Response(
                {"detail": "Source basket not found"}, status=status.HTTP_404_NOT_FOUND
            )

        target = _find_user_basket(request.user)
        if not target:
            target = Basket._default_manager.create(owner=request.user, status="Open")

        target.strategy = _get_request_strategy(request)
        try:
            target.merge(source)
        except Exception as e:
            return Response(
                {"detail": f"Unable to merge baskets: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(BasketSerializer(target, context={"request": request}).data)
