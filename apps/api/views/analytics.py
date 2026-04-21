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
Product = get_model("catalogue", "Product")
Category = get_model("catalogue", "Category")


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

        # Build product_id -> cost_price / price / partner_name maps from StockRecords
        cost_map = {}
        price_map = {}
        partner_map = {}
        for sr in StockRecord.objects.values("product_id", "cost_price", "price", "partner__name"):
            if sr["product_id"] not in cost_map:
                cost_map[sr["product_id"]] = sr["cost_price"] or Decimal("0")
            if sr["product_id"] not in price_map:
                price_map[sr["product_id"]] = sr["price"]
            if sr["product_id"] not in partner_map:
                partner_map[sr["product_id"]] = sr["partner__name"] or ""

        # Build maps to resolve child products to their parent
        # parent_map: child_product_id -> parent_product_id
        # title_map: product_id -> title
        # category_map: product_id -> first category name
        parent_map = {}
        title_map = {}
        category_map = {}

        for p in Product.objects.filter(
            structure__in=["standalone", "parent"]
        ).prefetch_related("categories"):
            title_map[p.id] = p.title
            cats = list(p.categories.values_list("name", flat=True))
            category_map[p.id] = cats[0] if cats else ""

        child_title_map = {}
        for p in Product.objects.filter(structure="child").values("id", "parent_id", "title"):
            parent_map[p["id"]] = p["parent_id"]
            child_title_map[p["id"]] = p["title"] or ""

        # Ordered list of category names (same order as homepage/products page)
        ordered_categories = list(
            Category.objects.order_by("name").values_list("name", flat=True)
        )

        total_revenue = Decimal("0")
        total_cost = Decimal("0")
        total_donations = Decimal("0")

        order_qs = Order.objects
        if start_date:
            order_qs = order_qs.filter(date_placed__date__gte=start_date)
        if end_date:
            order_qs = order_qs.filter(date_placed__date__lte=end_date)
        total_orders = order_qs.count()
        total_donations = sum(
            ((order.donation_amount or Decimal("0")) for order in order_qs.only("donation_amount")),
            Decimal("0"),
        )

        by_product = defaultdict(lambda: {
            "title": "",
            "partner": "",
            "category": "",
            "units_sold": 0,
            "revenue": Decimal("0"),
            "cost": Decimal("0"),
            "has_cost": False,
            "variants": defaultdict(int),
            "unit_price": None,
        })
        by_month = defaultdict(lambda: {
            "order_ids": set(),
            "revenue": Decimal("0"),
            "cost": Decimal("0"),
            "donations": Decimal("0"),
        })

        lines = OrderLine.objects.select_related("order", "product")
        if start_date:
            lines = lines.filter(order__date_placed__date__gte=start_date)
        if end_date:
            lines = lines.filter(order__date_placed__date__lte=end_date)

        for line in lines:
            raw_pid = line.product_id
            # Resolve child variants to their parent product for grouping
            pid = parent_map.get(raw_pid, raw_pid)

            # Cost/partner live on the child's stock record, so look up by raw_pid
            has_cost = raw_pid in cost_map and cost_map[raw_pid] > 0
            cost_price = cost_map.get(raw_pid, Decimal("0"))
            line_revenue = line.line_price_incl_tax or Decimal("0")
            line_cost = cost_price * line.quantity

            title = title_map.get(pid) or line.title or (line.product.title if line.product else "Unknown")
            category = category_map.get(pid, "")
            month = line.order.date_placed.strftime("%Y-%m")

            total_revenue += line_revenue
            total_cost += line_cost

            by_product[pid]["title"] = title
            by_product[pid]["partner"] = partner_map.get(raw_pid, "") or partner_map.get(pid, "")
            by_product[pid]["category"] = category
            by_product[pid]["units_sold"] += line.quantity
            by_product[pid]["revenue"] += line_revenue
            by_product[pid]["cost"] += line_cost
            by_product[pid]["has_cost"] = by_product[pid]["has_cost"] or has_cost
            if by_product[pid]["unit_price"] is None and price_map.get(pid) is not None:
                by_product[pid]["unit_price"] = price_map[pid]

            if raw_pid != pid:
                child_title = child_title_map.get(raw_pid, "")
                parent_title = title_map.get(pid, "")
                sep = f"{parent_title} - "
                label = child_title[len(sep):] if child_title.startswith(sep) else child_title
                by_product[pid]["variants"][label] += line.quantity

            by_month[month]["order_ids"].add(line.order_id)
            by_month[month]["revenue"] += line_revenue
            by_month[month]["cost"] += line_cost

        for order in order_qs.only("id", "date_placed", "donation_amount"):
            month = order.date_placed.strftime("%Y-%m")
            by_month[month]["order_ids"].add(order.id)
            by_month[month]["donations"] += order.donation_amount or Decimal("0")

        total_profit = total_revenue - total_cost
        profit_margin = float(total_profit / total_revenue * 100) if total_revenue else 0
        total_collected = total_revenue + total_donations

        products_list = []
        for pid, data in by_product.items():
            profit = data["revenue"] - data["cost"]
            margin = float(profit / data["revenue"] * 100) if data["revenue"] else 0
            size_order = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]
            variants = [
                {"label": label, "units_sold": qty}
                for label, qty in sorted(
                    data["variants"].items(),
                    key=lambda x: size_order.index(x[0]) if x[0] in size_order else len(size_order),
                )
            ]
            products_list.append({
                "product_id": pid,
                "title": data["title"],
                "partner": data["partner"],
                "category": data["category"],
                "units_sold": data["units_sold"],
                "revenue": str(data["revenue"].quantize(Decimal("0.01"))),
                "cost": str(data["cost"].quantize(Decimal("0.01"))) if data["has_cost"] else None,
                "profit": str(profit.quantize(Decimal("0.01"))) if data["has_cost"] else None,
                "margin": round(margin, 1) if data["has_cost"] else None,
                "unit_price": str(data["unit_price"].quantize(Decimal("0.01"))) if data["unit_price"] is not None else None,
                "variants": variants,
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
                "donations": str(data["donations"].quantize(Decimal("0.01"))),
                "collected": str((data["revenue"] + data["donations"]).quantize(Decimal("0.01"))),
            })

        partners = sorted({p["partner"] for p in products_list if p["partner"]})

        return Response({
            "partners": partners,
            "categories": ordered_categories,
            "summary": {
                "total_orders": total_orders,
                "total_revenue": str(total_revenue.quantize(Decimal("0.01"))),
                "total_donations": str(total_donations.quantize(Decimal("0.01"))),
                "total_collected": str(total_collected.quantize(Decimal("0.01"))),
                "total_cost": str(total_cost.quantize(Decimal("0.01"))),
                "total_profit": str(total_profit.quantize(Decimal("0.01"))),
                "profit_margin": round(profit_margin, 1),
            },
            "by_product": products_list,
            "by_month": months_list,
        })
