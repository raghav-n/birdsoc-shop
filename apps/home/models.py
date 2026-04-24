from django.db import models


class ShopConfig(models.Model):
    shop_open = models.BooleanField(default=True)
    shop_open_public = models.BooleanField(default=True)
    close_datetime = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Shop Configuration"

    def __str__(self):
        return "Shop Configuration"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
