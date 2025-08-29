from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from oscar.core.loading import get_model

from apps.api.serializers import OrderSerializer


Order = get_model("order", "Order")


class IsOwnerOrStaff(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_staff:
            return True
        return obj.user_id == getattr(request.user, "id", None)


class OrdersViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "number"

    def get_queryset(self):
        return Order._default_manager.filter(user=self.request.user).order_by("-date_placed")

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        self.check_object_permissions(request, obj)
        ser = OrderSerializer(obj)
        return Response(ser.data)

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, number=None):
        order = self.get_object()
        self.check_object_permissions(request, order)
        pdf_bytes = order.get_receipt_as_pdf()
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f"inline; filename=receipt-{number}.pdf"
        return resp

