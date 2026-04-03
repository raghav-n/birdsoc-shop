from django.db import models


class TextBanner(models.Model):
    text = models.TextField(help_text="Displayed as a sitewide text banner. HTML is supported.")
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Text Banner"
        verbose_name_plural = "Text Banners"

    def __str__(self):
        return self.text[:60]


class BannerImage(models.Model):
    image = models.ImageField(upload_to="banners/")
    show_on_product = models.BooleanField(
        default=False,
        help_text="Show on the homepage and products page",
    )
    show_on_event = models.BooleanField(
        default=False,
        help_text="Show on the homepage and events page",
    )
    order = models.PositiveIntegerField(default=0, help_text="Lower numbers appear first")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Banner Image"
        verbose_name_plural = "Banner Images"

    def __str__(self):
        tags = []
        if self.show_on_product:
            tags.append("product")
        if self.show_on_event:
            tags.append("event")
        return f"Banner #{self.pk} ({', '.join(tags) if tags else 'hidden'})"
