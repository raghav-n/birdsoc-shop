from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from oscar.core.loading import get_model

from apps.api.serializers import ProductSerializer, CategorySerializer


Product = get_model("catalogue", "Product")
Category = get_model("catalogue", "Category")
OrderLine = get_model("order", "Line")


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = ProductSerializer
    lookup_field = "pk"

    def get_queryset(self):
        qs = (
            Product._default_manager.exclude(structure="child")
            .select_related("product_class")
            .prefetch_related(
                "images",
                "stockrecords",
                "categories",
                "children__stockrecords",
                "children__attribute_values__attribute",
            )
        )
        is_public = self.request.query_params.get("is_public")
        if is_public is not None:
            qs = qs.filter(is_public=str(is_public).lower() in ("true", "1", "yes"))
        else:
            qs = qs.filter(is_public=True)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        category_slug = self.request.query_params.get("category")
        if category_slug:
            try:
                cat = Category._default_manager.get(slug=category_slug)
                qs = qs.filter(categories__in=cat.get_descendants_and_self())
            except Category.DoesNotExist:
                qs = qs.none()
        ordering = self.request.query_params.get("ordering")
        if ordering in {"title", "-title"}:
            qs = qs.order_by(ordering)
        # Note: true price ordering requires a join via stockrecords; omitted for simplicity
        return qs.distinct()

    @action(detail=False, methods=["get"])
    def popular(self, request):
        """Top products by units sold in the last 12 months."""
        try:
            limit = max(1, min(int(request.query_params.get("limit", 4)), 24))
        except (TypeError, ValueError):
            limit = 4

        cutoff = timezone.now() - timedelta(days=365)
        parent_map = dict(
            Product._default_manager.filter(structure="child")
            .values_list("id", "parent_id")
        )

        line_totals = (
            OrderLine.objects.filter(order__date_placed__gte=cutoff)
            .values("product_id")
            .annotate(units=Sum("quantity"))
        )

        totals = defaultdict(int)
        for row in line_totals:
            raw_pid = row["product_id"]
            if raw_pid is None:
                continue
            pid = parent_map.get(raw_pid, raw_pid)
            totals[pid] += row["units"] or 0

        ranked_ids = [pid for pid, _ in sorted(totals.items(), key=lambda x: x[1], reverse=True)]

        products = (
            Product._default_manager.filter(id__in=ranked_ids, is_public=True)
            .exclude(structure="child")
            .select_related("product_class")
            .prefetch_related(
                "images",
                "stockrecords",
                "categories",
                "children__stockrecords",
                "children__attribute_values__attribute",
            )
        )
        products_by_id = {p.id: p for p in products}
        ordered = [products_by_id[pid] for pid in ranked_ids if pid in products_by_id][:limit]

        ser = ProductSerializer(ordered, many=True, context={"request": request})
        return Response(ser.data)

    @action(detail=False, methods=["get"], url_path=r"slug/(?P<slug>[^/.]+)")
    def by_slug(self, request, slug):
        try:
            obj = Product._default_manager.get(slug=slug)
        except Product.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        ser = ProductSerializer(obj, context={"request": request})
        return Response(ser.data)

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get(self.lookup_field)
        obj = None
        # Try by numeric id first
        try:
            obj = Product._default_manager.get(pk=int(pk))
        except Exception:
            # Fallback to slug match
            try:
                obj = Product._default_manager.get(slug=pk)
            except Product.DoesNotExist:
                return Response({"detail": "Not found"}, status=404)
        ser = ProductSerializer(obj, context={"request": request})
        return Response(ser.data)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = CategorySerializer
    lookup_field = "slug"

    def get_queryset(self):
        qs = Category._default_manager.all()
        # Annotate product counts where useful (rough headcount)
        return qs.annotate(product_count=Count("product")).order_by("name")

    @action(detail=False, methods=["get"])  # /categories/tree
    def tree(self, request):
        roots = (
            Category._default_manager.filter(depth=1)
            .annotate(product_count=Count("product"))
            .order_by("name")
        )
        data = CategorySerializer(roots, many=True).data
        return Response(data)
