from django.conf import settings
from oscar.apps.order.processing import EventHandler as CoreEventHandler


class EventHandler(CoreEventHandler):
    def handle_order_status_change(self, order, new_status, note_msg=None, user=None):
        if order.sources.exists() and new_status == settings.PAYMENT_CONFIRMED_STATUS:
            for payment in order.sources.filter(source_type__code="paynow"):
                payment.verify(user)

        super().handle_order_status_change(order, new_status, note_msg=note_msg)
