from django.http import Http404, HttpResponse
from oscar.core.loading import get_model
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.api.serializers import OrderSerializer


Order = get_model("order", "Order")


class OrdersViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "number"

    def get_permissions(self):
        if self.action == "retrieve":
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        return Order._default_manager.filter(user=self.request.user).order_by(
            "-date_placed"
        )

    def _get_order_for_detail_access(self):
        number = self.kwargs.get(self.lookup_field)
        try:
            order = Order._default_manager.get(number=number)
        except Order.DoesNotExist as exc:
            raise Http404 from exc

        user = self.request.user
        is_owner_or_staff = bool(
            user.is_authenticated
            and (user.is_staff or order.user_id == getattr(user, "id", None))
        )
        has_valid_access_id = order.has_valid_collection_access_id(
            self.request.query_params.get("id")
        )
        if is_owner_or_staff or has_valid_access_id:
            return order
        raise Http404

    def retrieve(self, request, *args, **kwargs):
        obj = self._get_order_for_detail_access()
        ser = OrderSerializer(obj)
        return Response(ser.data)

    def _get_order_for_owner_or_staff(self):
        number = self.kwargs.get(self.lookup_field)
        try:
            order = Order._default_manager.get(number=number)
        except Order.DoesNotExist as exc:
            raise Http404 from exc

        user = self.request.user
        if user.is_authenticated and (user.is_staff or order.user_id == getattr(user, "id", None)):
            return order
        raise Http404

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, number=None):
        order = self._get_order_for_owner_or_staff()
        pdf_bytes = order.get_receipt_as_pdf()
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f"inline; filename=receipt-{number}.pdf"
        return resp
