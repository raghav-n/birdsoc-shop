import json
import pandas as pd
from datetime import date

from django import forms
from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.utils.timezone import localtime
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


class OrderExportForm(forms.Form):
    start_date = forms.DateField(
        required=True, widget=forms.DateInput(attrs={"type": "date"})
    )
    end_date = forms.DateField(
        required=True, widget=forms.DateInput(attrs={"type": "date"})
    )


class OrderSummaryView(View):
    def get(self, request):
        form = OrderExportForm()
        return render(
            request, "oscar/dashboard/orders/order_summary.html", {"form": form}
        )

    def post(self, request):
        form = OrderExportForm(request.POST)
        if form.is_valid():
            start_date = form.cleaned_data["start_date"]
            end_date = form.cleaned_data["end_date"]
            return self.export_to_excel(start_date, end_date)
        return render(
            request, "oscar/dashboard/orders/order_summary.html", {"form": form}
        )

    def export_to_excel(self, start_date: date, end_date: date):
        Order = get_model("order", "Order")
        Line = get_model("order", "Line")

        orders = Order.objects.filter(date_placed__range=(start_date, end_date))
        order_info = []

        for order in orders:
            customer_name = order.user.get_full_name() if order.user else "Guest"
            reference_number = order.number
            order_status = order.status
            date_placed = localtime(order.date_placed).strftime("%Y-%m-%d %H:%M:%S")
            items = Line.objects.filter(order=order)
            units_of_each_item = ", ".join(
                f"{item.product.title}: {item.quantity}" for item in items
            )
            total_cost = order.total_incl_tax_with_donation - order.donation_amount
            donation_amount = order.donation_amount
            total_with_donation = order.total_incl_tax_with_donation

            order_info.append(
                {
                    "reference_number": reference_number,
                    "customer_name": customer_name,
                    "date_placed": date_placed,
                    "order_status": order_status,
                    "units_of_each_item": units_of_each_item,
                    "total_cost": total_cost,
                    "donation_amount": donation_amount,
                    "total_with_donation": total_with_donation,
                }
            )

        df = pd.DataFrame(order_info)
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="orders_{start_date}_to_{end_date}.xlsx"'
        )
        df.to_excel(response, index=False)

        return response
