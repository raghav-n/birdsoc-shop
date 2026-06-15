import json
from decimal import Decimal, InvalidOperation

from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.views import View
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from django.template.response import TemplateResponse
from oscar.core.loading import get_model, get_class
from oscar.apps.dashboard.catalogue.views import ProductCreateUpdateView as OscarProductCreateUpdateView

from apps.dashboard.catalogue.forms import StockRecordForm as CustomStockRecordForm

ProductImage = get_model("catalogue", "ProductImage")
OscarStockRecordFormSet = get_class("dashboard.catalogue.formsets", "StockRecordFormSet")


class CustomStockRecordFormSet(OscarStockRecordFormSet):
    form = CustomStockRecordForm


class ProductCreateUpdateView(OscarProductCreateUpdateView):
    stockrecord_formset = CustomStockRecordFormSet


StockRecord = get_model("partner", "StockRecord")
Product = get_model("catalogue", "Product")


def _parse_cost(raw):
    """Return (Decimal, None) or raise InvalidOperation/ValueError."""
    raw = raw.strip()
    if raw == "":
        return None
    val = Decimal(raw)
    if val < 0:
        raise ValueError("negative")
    return val


def _build_rows():
    """
    Return a list of row dicts for the cost-price editor.

    Each row is one of:
      {"type": "standalone", "sr": <StockRecord>, "cost_price": ..., "field": "cost_<id>"}
      {"type": "parent",     "product": <Product>, "child_srs": [...], "cost_price": ..., "field": "parent_<id>"}
    """
    rows = []

    # Standalone products
    for sr in (
        StockRecord.objects
        .select_related("product", "partner")
        .filter(product__structure="standalone")
    ):
        rows.append({
            "type": "standalone",
            "sr": sr,
            "product": sr.product,
            "partner": sr.partner,
            "price": sr.price,
            "price_currency": sr.price_currency,
            "cost_price": sr.cost_price,
            "field": f"cost_{sr.id}",
        })

    # Parent products — one row per parent, propagates to all child SRs
    for parent in (
        Product.objects
        .filter(structure="parent", is_public=True)
        .prefetch_related("children__stockrecords__partner")
    ):
        child_srs = [
            sr
            for child in parent.children.all()
            for sr in child.stockrecords.all()
        ]
        if not child_srs:
            continue
        costs = {sr.cost_price for sr in child_srs}
        # Show the shared cost price only if all children agree
        cost_price = next(iter(costs)) if len(costs) == 1 else None
        partner = child_srs[0].partner
        price = child_srs[0].price
        price_currency = child_srs[0].price_currency
        rows.append({
            "type": "parent",
            "product": parent,
            "partner": partner,
            "price": price,
            "price_currency": price_currency,
            "cost_price": cost_price,
            "child_srs": child_srs,
            "field": f"parent_{parent.id}",
        })

    rows.sort(key=lambda r: (r["partner"].name, r["product"].title))
    return rows


@method_decorator(staff_member_required, name="dispatch")
class CostPriceListView(View):
    template_name = "oscar/dashboard/catalogue/cost_price_list.html"

    def get(self, request):
        return TemplateResponse(
            request,
            self.template_name,
            {"rows": _build_rows()},
        )

    def post(self, request):
        rows = _build_rows()
        updated = 0
        errors = 0

        for row in rows:
            raw = request.POST.get(row["field"], "")
            try:
                new_cost = _parse_cost(raw)
            except (InvalidOperation, ValueError):
                errors += 1
                continue

            if row["type"] == "standalone":
                sr = row["sr"]
                if sr.cost_price != new_cost:
                    sr.cost_price = new_cost
                    sr.save(update_fields=["cost_price"])
                    updated += 1
            else:
                for sr in row["child_srs"]:
                    if sr.cost_price != new_cost:
                        sr.cost_price = new_cost
                        sr.save(update_fields=["cost_price"])
                        updated += 1

        if errors:
            messages.warning(request, f"Saved {updated} cost price(s). {errors} invalid value(s) skipped.")
        else:
            messages.success(request, f"Saved {updated} cost price(s).")
        return redirect(reverse("dashboard:catalogue-cost-prices"))


def _parse_stock(raw):
    """Return (int, None) or raise ValueError for invalid/negative input."""
    raw = raw.strip()
    if raw == "":
        return None
    val = int(raw)
    if val < 0:
        raise ValueError("negative")
    return val


def _build_stock_groups():
    """
    Return a list of (category_name, [groups]) pairs for the stock-level editor.

    Groups within each category are sorted by title. Categories are sorted
    alphabetically, with "Uncategorised" last.

    Each group is one of:
      {"type": "standalone", "product": <Product>, "partner": <Partner>,
       "rows": [<row>]}
      {"type": "parent", "product": <Product>, "rows": [<row>, ...]}

    Each row:
      {"sr": <StockRecord>, "label": str, "num_in_stock": int|None,
       "allocated": int, "field": "stock_<sr.id>"}
    """
    from collections import defaultdict

    by_category = defaultdict(list)

    # Standalone products — one row each
    for sr in (
        StockRecord.objects
        .select_related("product", "partner")
        .prefetch_related("product__categories")
        .filter(product__structure="standalone")
    ):
        cats = sr.product.categories.all()
        category = cats[0].name if cats else "Uncategorised"
        allocated = sr.num_allocated or 0
        available = (sr.num_in_stock - allocated) if sr.num_in_stock is not None else None
        by_category[category].append({
            "type": "standalone",
            "product": sr.product,
            "partner": sr.partner,
            "sort_key": sr.product.title,
            "rows": [{
                "sr": sr,
                "label": sr.product.get_title(),
                "available": available,
                "field": f"stock_{sr.id}",
            }],
        })

    # Parent products — one group, one row per child variant
    for parent in (
        Product.objects
        .filter(structure="parent", is_public=True)
        .prefetch_related("categories", "children__stockrecords__partner")
    ):
        rows = []
        partner = None
        for child in parent.children.all():
            for sr in child.stockrecords.all():
                partner = partner or sr.partner
                allocated = sr.num_allocated or 0
                available = (sr.num_in_stock - allocated) if sr.num_in_stock is not None else None
                rows.append({
                    "sr": sr,
                    "label": child.get_title(),
                    "available": available,
                    "field": f"stock_{sr.id}",
                })
        if not rows:
            continue
        cats = parent.categories.all()
        category = cats[0].name if cats else "Uncategorised"
        by_category[category].append({
            "type": "parent",
            "product": parent,
            "partner": partner,
            "sort_key": parent.title,
            "rows": rows,
        })

    # Sort groups within each category, then sort categories alphabetically
    result = []
    for cat in sorted(by_category.keys(), key=lambda c: (c == "Uncategorised", c)):
        groups = sorted(by_category[cat], key=lambda g: g["sort_key"])
        result.append({"category": cat, "groups": groups})
    return result


@method_decorator(staff_member_required, name="dispatch")
class StockLevelListView(View):
    template_name = "oscar/dashboard/catalogue/stock_level_list.html"

    def get(self, request):
        return TemplateResponse(
            request,
            self.template_name,
            {"category_sections": _build_stock_groups()},
        )

    def post(self, request):
        category_sections = _build_stock_groups()
        updated = 0
        errors = 0

        for section in category_sections:
            for group in section["groups"]:
                for row in group["rows"]:
                    raw = request.POST.get(row["field"], "")
                    try:
                        new_stock = _parse_stock(raw)
                    except (ValueError, TypeError):
                        errors += 1
                        continue

                    sr = row["sr"]
                    new_num_in_stock = (new_stock + (sr.num_allocated or 0)) if new_stock is not None else None
                    if sr.num_in_stock != new_num_in_stock:
                        sr.num_in_stock = new_num_in_stock
                        sr.save(update_fields=["num_in_stock"])
                        updated += 1

        if errors:
            messages.warning(request, f"Saved {updated} stock level(s). {errors} invalid value(s) skipped.")
        else:
            messages.success(request, f"Saved {updated} stock level(s).")
        return redirect(reverse("dashboard:catalogue-stock-levels"))


@method_decorator(staff_member_required, name="dispatch")
class ProductImageAutoCropView(View):
    def post(self, request, image_id):
        try:
            img = ProductImage.objects.get(pk=image_id)
        except ProductImage.DoesNotExist:
            return JsonResponse({"error": "Image not found"}, status=404)

        from apps.catalogue.auto_crop import suggest_crop
        result = suggest_crop(img.original.path)

        ProductImage.objects.filter(pk=image_id).update(**result)
        return JsonResponse(result)


@method_decorator(staff_member_required, name="dispatch")
class ProductImageFocalPointView(View):
    def post(self, request, image_id):
        try:
            data = json.loads(request.body)
            x = int(data.get("focal_point_x", 50))
            y = int(data.get("focal_point_y", 50))
            zoom = float(data.get("zoom_level", 1.0))
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid values"}, status=400)

        x = max(0, min(100, x))
        y = max(0, min(100, y))
        zoom = max(1.0, min(3.0, zoom))

        updated = ProductImage.objects.filter(pk=image_id).update(
            focal_point_x=x, focal_point_y=y, zoom_level=zoom
        )
        if not updated:
            return JsonResponse({"error": "Image not found"}, status=404)

        return JsonResponse({"focal_point_x": x, "focal_point_y": y, "zoom_level": zoom})
