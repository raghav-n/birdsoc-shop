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
        fields = ["id", "email", "first_name", "last_name", "is_staff"]


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "full_name", "path", "description", "image", "product_count"]

    def get_image(self, obj: Category) -> str | None:
        if obj.image:
            return obj.image.url
        return None


class ProductImageSerializer(serializers.Serializer):
    original = serializers.CharField()
    caption = serializers.CharField(allow_blank=True)
    display_order = serializers.IntegerField()
    focal_point_x = serializers.IntegerField(default=50)
    focal_point_y = serializers.IntegerField(default=50)
    zoom_level = serializers.FloatField(default=1.0)


class ProductPriceSerializer(serializers.Serializer):
    excl_tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    incl_tax = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()


class ProductStockSerializer(serializers.Serializer):
    num_in_stock = serializers.IntegerField(allow_null=True)
    is_available = serializers.BooleanField()


class ProductChildSerializer(serializers.ModelSerializer):
    """Lightweight serializer for child/variant products."""
    price = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    attributes = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "title", "price", "stock", "attributes"]

    def _get_purchase_info(self, obj: Product):
        request = self.context.get("request")
        selector = Selector()
        strategy = selector.strategy(request=request)
        return strategy.fetch_for_product(obj)

    def _get_price_data(self, info):
        price = info.price
        if not price:
            return None
        incl = price.incl_tax if price.incl_tax is not None else price.excl_tax
        excl = price.excl_tax if price.excl_tax is not None else incl
        sr = info.stockrecord
        result = {"excl_tax": excl, "incl_tax": incl, "currency": price.currency}
        if sr and getattr(sr, "crossed_out_price", None):
            result["crossed_out_price"] = sr.crossed_out_price
        return result

    def get_price(self, obj: Product) -> dict[str, Any] | None:
        return self._get_price_data(self._get_purchase_info(obj))

    def get_stock(self, obj: Product) -> dict[str, Any]:
        info = self._get_purchase_info(obj)
        sr: StockRecord | None = info.stockrecord
        num = sr.num_in_stock if sr and sr.num_in_stock is not None else None
        is_available = bool(info.availability.is_available_to_buy)
        return {"num_in_stock": num, "is_available": is_available}

    def get_attributes(self, obj: Product) -> list[dict[str, str]]:
        return [
            {"name": av.attribute.name, "code": av.attribute.code, "value": av.value_as_text}
            for av in obj.attribute_values.select_related("attribute").all()
        ]


class ProductSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    category_slugs = serializers.SerializerMethodField()
    structure = serializers.CharField(read_only=True)
    children = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "upc",
            "slug",
            "title",
            "description",
            "is_public",
            "structure",
            "images",
            "price",
            "stock",
            "category_slugs",
            "children",
        ]

    def get_category_slugs(self, obj: Product) -> list[str]:
        return list(obj.categories.values_list("slug", flat=True))

    def get_images(self, obj: Product) -> list[dict[str, Any]]:
        results = []
        for img in obj.images.all().order_by("display_order", "id"):
            try:
                url = img.original.url
            except Exception:
                url = ""
            thumbnail_url = None
            if url:
                try:
                    from sorl.thumbnail import get_thumbnail
                    thumb = get_thumbnail(img.original, "648", quality=85)
                    thumbnail_url = thumb.url
                except Exception:
                    thumbnail_url = url
            results.append(
                {
                    "original": url,
                    "thumbnail": thumbnail_url,
                    "caption": img.caption or "",
                    "display_order": img.display_order or 0,
                    "focal_point_x": img.focal_point_x,
                    "focal_point_y": img.focal_point_y,
                    "zoom_level": img.zoom_level,
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
        sr = info.stockrecord
        result = {
            "excl_tax": excl,
            "incl_tax": incl,
            "currency": price.currency,
        }
        if sr and getattr(sr, "crossed_out_price", None):
            result["crossed_out_price"] = sr.crossed_out_price
        return result

    def get_stock(self, obj: Product) -> dict[str, Any]:
        info = self._get_purchase_info(obj)
        sr: StockRecord | None = info.stockrecord
        num = sr.num_in_stock if sr and sr.num_in_stock is not None else None
        is_available = bool(info.availability.is_available_to_buy)
        return {"num_in_stock": num, "is_available": is_available}

    def get_children(self, obj: Product) -> list[dict]:
        if obj.structure != "parent":
            return []
        children = obj.children.prefetch_related(
            "attribute_values__attribute", "stockrecords"
        ).all()
        return ProductChildSerializer(
            children, many=True, context=self.context
        ).data


class BasketLineSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source="product.title", read_only=True)
    product_image = serializers.SerializerMethodField()
    unit_price_incl_tax = serializers.SerializerMethodField()
    line_price_incl_tax = serializers.SerializerMethodField()

    class Meta:
        model = Line
        fields = [
            "id",
            "product_id",
            "stockrecord_id",
            "product_title",
            "product_image",
            "quantity",
            "unit_price_incl_tax",
            "line_price_incl_tax",
        ]
        read_only_fields = ["unit_price_incl_tax", "line_price_incl_tax"]

    def get_product_image(self, obj: Line) -> str | None:
        product = obj.product
        # Child products usually don't have their own images; fall back to parent
        target = product.parent if getattr(product, "parent_id", None) else product
        img = target.images.order_by("display_order", "id").first()
        if not img:
            return None
        try:
            original = img.original
            try:
                from sorl.thumbnail import get_thumbnail
                thumb = get_thumbnail(original, "320", quality=85)
                return thumb.url
            except Exception:
                return original.url
        except Exception:
            return None

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
    offer_discounts = serializers.SerializerMethodField()

    class Meta:
        model = Basket
        fields = [
            "id",
            "owner",
            "status",
            "currency",
            "total_excl_tax",
            "total_incl_tax",
            "offer_discounts",
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

    def get_offer_discounts(self, obj: Basket):
        discounts = []
        for discount in obj.offer_discounts:
            discounts.append({
                "name": discount["name"],
                "amount": str(discount["discount"]),
            })
        for discount in obj.grouped_voucher_discounts:
            voucher = discount["voucher"]
            discounts.append({
                "name": voucher.name,
                "amount": str(discount["discount"]),
                "voucher_code": voucher.code,
            })
        return discounts


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
