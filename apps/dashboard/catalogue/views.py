import json
from django.http import JsonResponse
from django.views import View
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from oscar.core.loading import get_model

ProductImage = get_model("catalogue", "ProductImage")


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
