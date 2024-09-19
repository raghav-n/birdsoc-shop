import json

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views import View
from oscar.core.loading import get_model


@method_decorator(staff_member_required, name="dispatch")
class OrderLookupView(View):
    template_name = "oscar/dashboard/orders/order_lookup.html"

    def get(self, request):
        return render(request, self.template_name)

    def post(self, request):
        Order = get_model("order", "Order")

        order_number = json.loads(request.body.decode())["order_number"]

        try:
            order = Order._default_manager.get(number=order_number)
        except Order.DoesNotExist:
            return JsonResponse({"success": False, "message": "No matching order"})

        items = list(order.lines.values("title", "quantity"))

        return JsonResponse(
            {
                "success": True,
                "customer_name": order.user.get_full_name(),
                "status": order.status,
                "items": items,
            }
        )


@method_decorator(staff_member_required, name="dispatch")
class OrderCollectionView(View):
    def post(self, request):
        Order = get_model("order", "Order")

        order_number = json.loads(request.body.decode())["order_number"]

        try:
            order = Order._default_manager.get(number=order_number)
        except Order.DoesNotExist:
            return JsonResponse({"success": False, "message": "No matching order"})

        try:
            order.set_status(settings.COLLECTED_STATUS)
        except Exception as e:
            return JsonResponse(
                {"success": False, "message": f"{e.__class__.__name__}: {e}"}
            )

        return JsonResponse({"success": True})
