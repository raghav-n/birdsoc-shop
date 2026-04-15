from django.conf import settings
from django.db.models import Q
from oscar.core.loading import get_model
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

Order = get_model("order", "Order")


def _customer_name(order):
    if order.user_id and order.user:
        full_name = order.user.get_full_name().strip()
        if full_name:
            return full_name
    if order.guest_email:
        return order.guest_email
    return "Guest"


def _line_title(line):
    title = (line.title or "").strip()
    if "[" in title:
        return title[: title.index("[")].rstrip()
    return title


def _line_category(line):
    product = line.product
    while product:
        cats = list(product.categories.all())
        if cats:
            return cats[0].name
        product = product.parent
    return "Other"


def _order_payload(order):
    return {
        "number": order.number,
        "customer_name": _customer_name(order),
        "status": order.status,
        "items": [
            {
                "title": _line_title(line),
                "quantity": line.quantity,
                "category": _line_category(line),
            }
            for line in order.lines.all()
        ],
    }


class OrderSearchView(APIView):
    """Search orders by number prefix or customer name. Staff only."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        number = request.query_params.get("number", "").strip()
        name = request.query_params.get("name", "").strip()
        access_id = request.query_params.get("id", "").strip()

        # Single-order lookup by number + access_id (QR code scan)
        if number and access_id:
            try:
                order = Order._default_manager.prefetch_related(
                    "lines__product__categories",
                    "lines__product__parent__categories",
                ).get(number=number)
            except Order.DoesNotExist:
                return Response({"orders": []})
            if not order.has_valid_collection_access_id(access_id):
                return Response(
                    {"detail": "Invalid access ID"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response({"orders": [_order_payload(order)]})

        if not number and not name:
            return Response({"orders": []})

        q = Q()
        if number:
            q &= Q(number__startswith=number)
        if name:
            q &= Q(user__first_name__icontains=name) | Q(user__last_name__icontains=name)

        orders = (
            Order._default_manager.filter(q)
            .select_related("user")
            .prefetch_related(
                "lines__product__categories",
                "lines__product__parent__categories",
            )[:25]
        )
        return Response({"orders": [_order_payload(o) for o in orders]})


class OrderCollectView(APIView):
    """Mark an order as collected. Staff only."""

    permission_classes = [permissions.IsAdminUser]

    def post(self, request, number):
        try:
            order = Order._default_manager.get(number=number)
        except Order.DoesNotExist:
            return Response(
                {"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND
            )
        order.set_status(settings.COLLECTED_STATUS)
        return Response({"success": True})
