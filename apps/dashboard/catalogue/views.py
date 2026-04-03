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


@method_decorator(staff_member_required, name="dispatch")
class ProductImageAutoCropView(View):
    def post(self, request, image_id):
        try:
            img = ProductImage.objects.get(pk=image_id)
        except ProductImage.DoesNotExist:
            return JsonResponse({"error": "Image not found"}, status=404)

        try:
            from apps.catalogue.auto_crop import suggest_crop
            result = suggest_crop(img.original.path)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

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
