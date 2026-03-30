from oscar.apps.checkout.mixins import OrderPlacementMixin as CoreOrderPlacementMixin


class OrderPlacementMixin(CoreOrderPlacementMixin):
    def send_order_placed_email(self, order):
        # Disabled: the only customer email is the payment-confirmed receipt.
        pass
