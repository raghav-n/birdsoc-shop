from django.db import models
from oscar.apps.catalogue.abstract_models import AbstractProductImage


class ProductImage(AbstractProductImage):
    focal_point_x = models.PositiveSmallIntegerField(default=50)
    focal_point_y = models.PositiveSmallIntegerField(default=50)
    zoom_level = models.FloatField(default=1.0)

    class Meta(AbstractProductImage.Meta):
        app_label = "catalogue"


from oscar.apps.catalogue.models import *  # noqa
