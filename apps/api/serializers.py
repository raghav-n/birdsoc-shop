from typing import Any

from django.contrib.auth import get_user_model
from rest_framework import serializers
from oscar.core.loading import get_model, get_class

from apps.faq.models import FAQItem

Product = get_model("catalogue", "Product")
Category = get_model("catalogue", "Category")
StockRecord = get_model("partner", "StockRecord")
Basket = get_model("basket", "Basket")
Line = get_model("basket", "Line")
Order = get_model("order", "Order")
Source = get_model("payment", "Source")

Selector = get_class("partner.strategy", "Selector")


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["id", "email", "first_name", "last_name"]


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "full_name", "path", "product_count"]


class ProductImageSerializer(serializers.Serializer):
    original = serializers.CharField()
    caption = serializers.CharField(allow_blank=True)
    display_order = serializers.IntegerField()


class ProductPriceSerializer(serializers.Serializer):
    excl_tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    incl_tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()


class ProductStockSerializer(serializers.Serializer):
    num_in_stock = serializers.IntegerField(allow_null=True)
    is_available = serializers.BooleanField()


class ProductSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "upc",
            "slug",
            "title",
            "description",
            "is_public",
            "images",
            "price",
            "stock",
        ]

    def get_images(self, obj: Product) -> list[dict[str, Any]]:
        results = []
        for img in obj.images.all().order_by("display_order", "id"):
            try:
                url = img.original.url
            except Exception:
                url = ""
            results.append(
                {
                    "original": url,
                    "caption": img.caption or "",
                    "display_order": img.display_order or 0,
                }
            )
        return results

    def _get_purchase_info(self, obj: Product):
        request = self.context.get("request")
        selector = Selector()
        strategy = selector.strategy(request=request)
        return strategy.fetch_for_product(obj)

    def get_price(self, obj: Product) -> dict[str, Any] | None:
        info = self._get_purchase_info(obj)
        price = info.price
        if not price:
            return None
        incl = price.incl_tax if price.incl_tax is not None else price.excl_tax
        excl = price.excl_tax if price.excl_tax is not None else incl
        return {
            "excl_tax": excl,
            "incl_tax": incl,
            "currency": price.currency,
        }

    def get_stock(self, obj: Product) -> dict[str, Any]:
        info = self._get_purchase_info(obj)
        sr: StockRecord | None = info.stockrecord
        num = sr.num_in_stock if sr and sr.num_in_stock is not None else None
        is_available = bool(info.availability.is_available_to_buy)
        return {"num_in_stock": num, "is_available": is_available}


class BasketLineSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)
    unit_price_incl_tax = serializers.SerializerMethodField()
    line_price_incl_tax = serializers.SerializerMethodField()

    class Meta:
        model = Line
        fields = [
            "id",
            "product_id",
            "product_title",
            "quantity",
            "unit_price_incl_tax",
            "line_price_incl_tax",
        ]
        read_only_fields = ["unit_price_incl_tax", "line_price_incl_tax"]

    def get_unit_price_incl_tax(self, obj: Line):
        if obj.unit_price_incl_tax is not None:
            return obj.unit_price_incl_tax
        # Fallback via strategy
        request = self.context.get("request")
        selector = Selector()
        strategy = selector.strategy(request=request)
        info = strategy.fetch_for_product(obj.product)
        return info.price.incl_tax if info.price else None

    def get_line_price_incl_tax(self, obj: Line):
        if obj.line_price_incl_tax is not None:
            return obj.line_price_incl_tax
        unit = self.get_unit_price_incl_tax(obj)
        if unit is None:
            return None
        return unit * obj.quantity


class BasketSerializer(serializers.ModelSerializer):
    lines = BasketLineSerializer(many=True, source="all_lines", read_only=True)
    owner = UserSerializer(read_only=True)
    total_incl_tax = serializers.SerializerMethodField()
    total_excl_tax = serializers.SerializerMethodField()

    class Meta:
        model = Basket
        fields = [
            "id",
            "owner",
            "status",
            "currency",
            "total_excl_tax",
            "total_incl_tax",
            "lines",
        ]

    def _assign_strategy(self, basket: Basket):
        request = self.context.get("request")
        selector = Selector()
        basket.strategy = selector.strategy(request=request)

    def get_total_incl_tax(self, obj: Basket):
        self._assign_strategy(obj)
        return getattr(obj, "total_incl_tax", None)

    def get_total_excl_tax(self, obj: Basket):
        self._assign_strategy(obj)
        return getattr(obj, "total_excl_tax", None)


class OrderSourceSerializer(serializers.ModelSerializer):
    source_type = serializers.CharField(source="source_type.name")

    class Meta:
        model = Source
        fields = [
            "source_type",
            "amount_debited",
            "reference",
            "payment_verified",
            "payment_verified_on",
        ]


class OrderLineLiteSerializer(serializers.Serializer):
    upc = serializers.CharField()
    title = serializers.CharField()
    quantity = serializers.IntegerField()
    unit_price_incl_tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    line_price_incl_tax = serializers.DecimalField(max_digits=12, decimal_places=2)


class OrderSerializer(serializers.ModelSerializer):
    lines = serializers.SerializerMethodField()
    sources = OrderSourceSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "number",
            "status",
            "date_placed",
            "currency",
            "total_incl_tax",
            "total_tax",
            "donation_amount",
            "lines",
            "sources",
        ]

    def get_lines(self, obj: Order):
        results = []
        for l in obj.lines.select_related("product").all():
            results.append(
                {
                    "upc": l.upc or (l.product.upc if l.product_id else None),
                    "title": l.title or (l.description or ""),
                    "quantity": l.quantity,
                    "unit_price_incl_tax": l.unit_price_incl_tax,
                    "line_price_incl_tax": l.line_price_incl_tax,
                }
            )
        return results


class FAQItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = ["id", "question", "answer", "position"]


class RefundRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_model("refund", "RefundRequest")
        fields = [
            "id",
            "name",
            "email",
            "paynow_phone",
            "order_number",
            "amount",
            "reason",
            "status",
            "created_at",
        ]
