from collections import OrderedDict
from decimal import Decimal

from oscar.core.loading import get_class, get_model
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


ConditionalOffer = get_model("offer", "ConditionalOffer")
Benefit = get_model("offer", "Benefit")
Selector = get_class("partner.strategy", "Selector")


def _product_image_url(product, size="320"):
    target = product.parent if getattr(product, "parent_id", None) else product
    img = target.images.order_by("display_order", "id").first()
    if not img:
        return None
    try:
        original = img.original
    except Exception:
        return None
    try:
        from sorl.thumbnail import get_thumbnail

        return get_thumbnail(original, size, quality=85).url
    except Exception:
        try:
            return original.url
        except Exception:
            return None


def _display_product(product):
    """Return the product that should be shown in the bundle UI.

    For variants (child products), display the parent instead so the
    bundle shows e.g. "Knot Frigatebird Shirt" rather than every size.
    """
    return product.parent if getattr(product, "parent_id", None) else product


def _price_for(strategy, product):
    """Best-effort retail price for a product (the parent if a variant).

    Falls back to the lowest priced variant if the parent has no own price.
    """
    target = product
    info = strategy.fetch_for_product(target)
    if info.price and info.price.incl_tax is not None:
        return info.price.incl_tax, info.price.currency
    if target.structure == "parent":
        cheapest = None
        currency = None
        for child in target.children.all():
            cinfo = strategy.fetch_for_product(child)
            if not cinfo.price or cinfo.price.incl_tax is None:
                continue
            if cheapest is None or cinfo.price.incl_tax < cheapest:
                cheapest = cinfo.price.incl_tax
                currency = cinfo.price.currency
        return cheapest, currency
    return None, None


class BundleListView(APIView):
    """Active fixed-price bundle offers, suitable for automated frontend display."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        offers = (
            ConditionalOffer.objects
            .filter(offer_type=ConditionalOffer.SITE)
            .select_related("benefit", "condition", "condition__range")
            .order_by("priority", "id")
        )

        strategy = Selector().strategy(request=request)
        data = []
        for offer in offers:
            if not offer.is_available():
                continue
            benefit = offer.benefit
            condition = offer.condition
            if not benefit or not condition or not condition.range:
                continue
            if benefit.type != Benefit.FIXED_PRICE:
                continue

            products = list(condition.range.included_products.all())
            if not products:
                continue

            unique = OrderedDict()
            for p in products:
                display = _display_product(p)
                if display.id in unique:
                    continue
                if not display.is_public:
                    continue
                unique[display.id] = display

            items = []
            total_original = Decimal("0")
            currency = None
            shared_categories = None
            for display in unique.values():
                price, cur = _price_for(strategy, display)
                if cur and not currency:
                    currency = cur
                cat_slugs = set(display.categories.values_list("slug", flat=True))
                shared_categories = (
                    cat_slugs if shared_categories is None
                    else shared_categories & cat_slugs
                )
                items.append(
                    {
                        "product_id": display.id,
                        "title": display.title,
                        "slug": display.slug,
                        "image": _product_image_url(display),
                        "price": str(price) if price is not None else None,
                        "structure": display.structure,
                    }
                )
                if price is not None:
                    total_original += Decimal(price)

            if not items:
                continue

            bundle_price = Decimal(benefit.value)
            # For "any N" bundles (Count condition), the original price baseline
            # is "N cheapest items" rather than "all items", which would over-
            # state savings. Use the lowest N prices in that case.
            condition_type = condition.type
            try:
                condition_value = int(condition.value)
            except (TypeError, ValueError):
                condition_value = len(items)

            prices_only = [Decimal(i["price"]) for i in items if i["price"] is not None]
            if condition_type == condition.COUNT and prices_only:
                baseline = sum(sorted(prices_only)[:condition_value])
            else:
                baseline = total_original

            savings = baseline - bundle_price if baseline > bundle_price else Decimal("0")

            shared_slug = (
                sorted(shared_categories)[0]
                if shared_categories
                else None
            )

            data.append(
                {
                    "id": offer.id,
                    "name": offer.name,
                    "description": offer.description or "",
                    "bundle_price": str(bundle_price),
                    "original_price": str(baseline),
                    "savings": str(savings),
                    "currency": currency or "SGD",
                    "condition_type": condition_type,
                    "condition_value": condition_value,
                    "category_slug": shared_slug,
                    "items": items,
                }
            )

        return Response(data)
