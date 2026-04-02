from django.urls import path
from apps.dashboard.catalogue.views import ProductImageFocalPointView, ProductImageAutoCropView

urlpatterns = [
    path(
        "images/<int:image_id>/focal-point/",
        ProductImageFocalPointView.as_view(),
        name="catalogue-image-focal-point",
    ),
    path(
        "images/<int:image_id>/auto-crop/",
        ProductImageAutoCropView.as_view(),
        name="catalogue-image-auto-crop",
    ),
]
