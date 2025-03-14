from django.db import models
from decimal import Decimal as D

from oscar.apps.shipping.models import *
from oscar.core import prices


class DynamicShippingMethod(models.Model):
    name = models.CharField(max_length=255, unique=True)
    active = models.BooleanField(default=False, null=False)
    end_date = models.DateField(blank=True, null=True)
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True, null=True)
    email_description = models.TextField(
        blank=True, null=True, verbose_name="Email description"
    )
    email_description_full = models.TextField(
        blank=True, null=True, verbose_name="Full email description"
    )
    website_home_description = models.TextField(
        blank=True, null=True, verbose_name="Website home description"
    )
    website_faq_description = models.TextField(
        blank=True, null=True, verbose_name="Website FAQ description"
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    available_to_public = models.BooleanField(default=True, null=False)
    is_self_collect = models.BooleanField(default=False, null=False)
    is_discounted = False

    @property
    def charge_excl_tax(self):
        return D(self.price)

    @property
    def charge_incl_tax(self):
        return D(self.price)

    def calculate(self, basket):
        return prices.Price(
            currency=basket.currency,
            excl_tax=self.charge_excl_tax,
            incl_tax=self.charge_incl_tax,
        )

    def to_dict(self):
        return {"code": self.code, "name": self.name, "description": self.description}
