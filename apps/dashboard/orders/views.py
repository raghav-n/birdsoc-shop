import json
from io import BytesIO

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import login
from django.http import JsonResponse
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.views import View
from oscar.core.loading import get_model

from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import user_passes_test

import pandas as pd
from django.http import HttpResponse


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


@method_decorator(user_passes_test(lambda u: u.is_superuser), name="dispatch")
class OrderExportView(View):
    def get(self, request, *args, **kwargs):
        Line = get_model("order", "Line")
        df = pd.DataFrame(
            Line._default_manager.select_related("order").values(
                "order__number",
                "order__user__first_name",
                "order__user__last_name",
                "order__status",
                "title",
                "quantity",
            )
        )
        df["quantity x item"] = (
            df["quantity"].astype(str)
            + "x "
            + df["title"].str.replace("\[[a-zA-Z ]+\]", "", regex=True)
        ).str.strip()

        grouped = df.groupby("order__number").agg(
            {
                "order__user__first_name": "first",
                "order__user__last_name": "first",
                "order__status": "first",
                "quantity x item": "\n".join,
            }
        )

        grouped["order__user__name"] = (
            grouped["order__user__first_name"] + " " + grouped["order__user__last_name"]
        )
        grouped = grouped.drop(
            columns=["order__user__first_name", "order__user__last_name"]
        )
        grouped.index = grouped.index.astype(int)

        output = BytesIO()
        # Save the DataFrame to the output stream as an Excel file
        grouped[["order__user__name", "order__status", "quantity x item"]].to_excel(
            output, index=True, engine="openpyxl"
        )

        # Set the stream position to the beginning
        output.seek(0)

        # Create the HTTP response with the Excel file as an attachment
        response = HttpResponse(
            output,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="exported_data.xlsx"'
        return response
