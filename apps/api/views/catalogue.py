from django.db.models import Count, Q
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from oscar.core.loading import get_model

from apps.api.serializers import ProductSerializer, CategorySerializer


Product = get_model("catalogue", "Product")
Category = get_model("catalogue", "Category")


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = ProductSerializer
    lookup_field = "pk"

    def get_queryset(self):
        qs = (
            Product._default_manager.exclude(structure="child")
            .select_related("product_class")
            .prefetch_related("images", "stockrecords", "categories")
        )
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
        is_public = self.request.query_params.get("is_public")
        if is_public is not None:
            v = str(is_public).lower() in ("true", "1", "yes")
            qs = qs.filter(is_public=v)
        ordering = self.request.query_params.get("ordering")
        if ordering in {"title", "-title"}:
            qs = qs.order_by(ordering)
        # Note: true price ordering requires a join via stockrecords; omitted for simplicity
        return qs.distinct()

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
        return qs.annotate(product_count=Count("product"))

    @action(detail=False, methods=["get"])  # /categories/tree
    def tree(self, request):
        roots = (
            Category._default_manager.filter(depth=1)
            .annotate(product_count=Count("product"))
            .order_by("path")
        )
        data = CategorySerializer(roots, many=True).data
        return Response(data)
