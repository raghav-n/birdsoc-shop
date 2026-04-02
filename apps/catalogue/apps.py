import oscar.apps.catalogue.apps as apps
from django.urls import path


class CatalogueConfig(apps.CatalogueConfig):
    name = "apps.catalogue"

    def get_home_url_pattern(self):
        from apps.catalogue.views import HomeView

        return path("", HomeView.as_view(), name="home")

    def ready(self):
        super().ready()
        from django.db.models.signals import post_save
        from oscar.core.loading import get_model

        ProductImage = get_model("catalogue", "ProductImage")
        post_save.connect(_auto_crop_on_create, sender=ProductImage)


def _auto_crop_on_create(sender, instance, created, **_kwargs):
    if not created:
        return
    try:
        from apps.catalogue.auto_crop import suggest_crop
        result = suggest_crop(instance.original.path)
        sender.objects.filter(pk=instance.pk).update(**result)
    except Exception:
        pass  # Never fail the save if Gemini is unavailable
