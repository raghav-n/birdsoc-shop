from django.conf import settings
from oscar.apps.order.utils import OrderNumberGenerator as CoreOrderNumberGenerator


class OrderNumberGenerator(CoreOrderNumberGenerator):

    def order_number(self, basket=None):
        """
        Return an order number for a given basket
        """
        return settings.BASE_ORDER_NUMBER + basket.id
