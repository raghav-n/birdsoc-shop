from django.conf import settings
from django.db.models import Case, IntegerField, Q, Value, When
from django.db.models.functions import Concat
from oscar.core.loading import get_model
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.api.permissions import IsMerchSalesStaff

Order = get_model("order", "Order")

LINE_PREFETCH = (
    "lines__product__categories",
    "lines__product__parent__categories",
)


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


def _person_q(order):
    """Match all orders belonging to the same person as ``order``."""
    if order.user_id:
        return Q(user_id=order.user_id)
    if order.guest_email:
        return Q(guest_email__iexact=order.guest_email, user__isnull=True)
    return Q(pk=order.pk)


def _orders_payload(q):
    """Return payloads for orders matching ``q``, uncollected first."""
    orders = (
        Order._default_manager.annotate(
            full_name_fl=Concat("user__first_name", Value(" "), "user__last_name"),
            full_name_lf=Concat("user__last_name", Value(" "), "user__first_name"),
            _collected_sort=Case(
                When(status=settings.COLLECTED_STATUS, then=1),
                default=0,
                output_field=IntegerField(),
            ),
        )
        .filter(q)
        .select_related("user")
        .prefetch_related(*LINE_PREFETCH)
        .order_by("_collected_sort", "-date_placed")[:25]
    )
    return [_order_payload(o) for o in orders]


class OrderSearchView(APIView):
    """Search orders by number prefix or customer name. Staff only.

    A number/QR lookup returns every order belonging to the matched
    customer(s), so staff can hand over all of a person's orders at once.
    """

    permission_classes = [IsMerchSalesStaff]

    def get(self, request):
        number = request.query_params.get("number", "").strip()
        name = request.query_params.get("name", "").strip()
        access_id = request.query_params.get("id", "").strip()

        # QR code scan: validate the access id against the scanned order,
        # then return all of that person's orders.
        if number and access_id:
            try:
                order = Order._default_manager.select_related("user").get(
                    number=number
                )
            except Order.DoesNotExist:
                return Response({"orders": []})
            if not order.has_valid_collection_access_id(access_id):
                return Response(
                    {"detail": "Invalid access ID"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response({"orders": _orders_payload(_person_q(order))})

        if not number and not name:
            return Response({"orders": []})

        # Number entry: find the matching order(s), then expand to every
        # order belonging to the same person(s).
        if number:
            seeds = list(
                Order._default_manager.filter(number__startswith=number)
                .select_related("user")[:25]
            )
            if not seeds:
                return Response({"orders": []})
            q = Q()
            for seed in seeds:
                q |= _person_q(seed)
            return Response({"orders": _orders_payload(q)})

        # Name search.
        q = Q(full_name_fl__icontains=name) | Q(full_name_lf__icontains=name)
        return Response({"orders": _orders_payload(q)})


class OrderCollectView(APIView):
    """Mark an order as collected. Staff only."""

    permission_classes = [IsMerchSalesStaff]

    def post(self, request, number):
        try:
            order = Order._default_manager.get(number=number)
        except Order.DoesNotExist:
            return Response(
                {"detail": "Order not found"}, status=status.HTTP_404_NOT_FOUND
            )
        order.set_status(settings.COLLECTED_STATUS)
        return Response({"success": True})
