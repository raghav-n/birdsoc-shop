from django.db import models

from oscar.apps.order.abstract_models import AbstractOrder
from oscar.apps.order.abstract_models import AbstractPaymentEvent
from oscar.core.loading import get_class

Repository = get_class("shipping.repository", "Repository")


class Order(AbstractOrder):
    collection_location = models.CharField(max_length=255, null=True, blank=True)
    collection_date = models.DateField(null=True, blank=True)

    def get_shipping_method(self):
        """
        Return the selected shipping method instance from this checkout session

        The shipping address is passed as we need to check that the method
        stored in the session is still valid for the shipping address.
        """
        methods = Repository().get_available_shipping_methods(basket=None)
        for method in methods:
            if method.name == self.shipping_method:
                return method


from oscar.apps.order.models import *
