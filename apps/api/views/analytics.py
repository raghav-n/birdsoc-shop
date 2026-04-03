from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from oscar.core.loading import get_model

Order = get_model("order", "Order")
OrderLine = get_model("order", "Line")
StockRecord = get_model("partner", "StockRecord")


class AnalyticsDashboardView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        # Parse optional date range filters
        start_str = request.query_params.get("start")
        end_str = request.query_params.get("end")
        start_date = None
        end_date = None
        try:
            if start_str:
                start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            if end_str:
                end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
        except ValueError:
            pass

        # Build product_id -> cost_price / partner_name maps from StockRecords
        cost_map = {}
        partner_map = {}
        for sr in StockRecord.objects.values("product_id", "cost_price", "partner__name"):
            if sr["product_id"] not in cost_map:
                cost_map[sr["product_id"]] = sr["cost_price"] or Decimal("0")
            if sr["product_id"] not in partner_map:
                partner_map[sr["product_id"]] = sr["partner__name"] or ""

        total_revenue = Decimal("0")
        total_cost = Decimal("0")

        order_qs = Order.objects
        if start_date:
            order_qs = order_qs.filter(date_placed__date__gte=start_date)
        if end_date:
            order_qs = order_qs.filter(date_placed__date__lte=end_date)
        total_orders = order_qs.count()

        by_product = defaultdict(lambda: {
            "title": "",
            "partner": "",
            "units_sold": 0,
            "revenue": Decimal("0"),
            "cost": Decimal("0"),
            "has_cost": False,
        })
        by_month = defaultdict(lambda: {
            "order_ids": set(),
            "revenue": Decimal("0"),
            "cost": Decimal("0"),
        })

        lines = OrderLine.objects.select_related("order", "product")
        if start_date:
            lines = lines.filter(order__date_placed__date__gte=start_date)
        if end_date:
            lines = lines.filter(order__date_placed__date__lte=end_date)

        for line in lines:
            pid = line.product_id
            has_cost = pid in cost_map and cost_map[pid] > 0
            cost_price = cost_map.get(pid, Decimal("0"))
            line_revenue = line.line_price_incl_tax or Decimal("0")
            line_cost = cost_price * line.quantity

            title = line.title or (line.product.title if line.product else "Unknown")
            month = line.order.date_placed.strftime("%Y-%m")

            total_revenue += line_revenue
            total_cost += line_cost

            by_product[pid]["title"] = title
            by_product[pid]["partner"] = partner_map.get(pid, "")
            by_product[pid]["units_sold"] += line.quantity
            by_product[pid]["revenue"] += line_revenue
            by_product[pid]["cost"] += line_cost
            by_product[pid]["has_cost"] = by_product[pid]["has_cost"] or has_cost

            by_month[month]["order_ids"].add(line.order_id)
            by_month[month]["revenue"] += line_revenue
            by_month[month]["cost"] += line_cost

        total_profit = total_revenue - total_cost
        profit_margin = float(total_profit / total_revenue * 100) if total_revenue else 0

        products_list = []
        for pid, data in by_product.items():
            profit = data["revenue"] - data["cost"]
            margin = float(profit / data["revenue"] * 100) if data["revenue"] else 0
            products_list.append({
                "product_id": pid,
                "title": data["title"],
                "partner": data["partner"],
                "units_sold": data["units_sold"],
                "revenue": str(data["revenue"].quantize(Decimal("0.01"))),
                "cost": str(data["cost"].quantize(Decimal("0.01"))) if data["has_cost"] else None,
                "profit": str(profit.quantize(Decimal("0.01"))) if data["has_cost"] else None,
                "margin": round(margin, 1) if data["has_cost"] else None,
            })
        products_list.sort(key=lambda x: float(x["revenue"]), reverse=True)

        months_list = []
        for month, data in sorted(by_month.items()):
            profit = data["revenue"] - data["cost"]
            months_list.append({
                "month": month,
                "orders": len(data["order_ids"]),
                "revenue": str(data["revenue"].quantize(Decimal("0.01"))),
                "cost": str(data["cost"].quantize(Decimal("0.01"))),
                "profit": str(profit.quantize(Decimal("0.01"))),
            })

        partners = sorted({p["partner"] for p in products_list if p["partner"]})

        return Response({
            "partners": partners,
            "summary": {
                "total_orders": total_orders,
                "total_revenue": str(total_revenue.quantize(Decimal("0.01"))),
                "total_cost": str(total_cost.quantize(Decimal("0.01"))),
                "total_profit": str(total_profit.quantize(Decimal("0.01"))),
                "profit_margin": round(profit_margin, 1),
            },
            "by_product": products_list,
            "by_month": months_list,
        })
