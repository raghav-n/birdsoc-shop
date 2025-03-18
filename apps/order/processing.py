from django.conf import settings
from oscar.apps.order.processing import EventHandler as CoreEventHandler
from oscar.core.loading import get_model, get_class


class EventHandler(CoreEventHandler):
    def handle_order_status_change(self, order, new_status, note_msg=None, user=None):
        if order.sources.exists() and (
            new_status
            in [
                settings.PAYMENT_CONFIRMED_STATUS,
                settings.PAYMENT_AUTO_CONFIRMED_STATUS,
            ]
        ):
            for payment in order.sources.filter(source_type__code="paynow"):
                payment.verify(user)

            OrderDispatcher = get_class("order.utils", "OrderDispatcher")
            dispatcher = OrderDispatcher()
            context = {"order": order}
            dispatcher.send_payment_confirmed_email_for_user(order, context)

        elif new_status == settings.COLLECTION_INFO_SENT_STATUS:
            OrderDispatcher = get_class("order.utils", "OrderDispatcher")
            dispatcher = OrderDispatcher()
            context = {"order": order, "name": order.user.first_name}
            dispatcher.send_collection_info_sent_email_for_user(order, context)

        elif new_status == settings.COLLECTED_STATUS:
            ShippingEventType = get_model("order", "ShippingEventType")
            collection_event_type = ShippingEventType._default_manager.get(
                code="collected"
            )
            self.handle_shipping_event(
                order,
                collection_event_type,
                order.lines.all(),
                order.lines.values_list("quantity", flat=True),
            )

        super().handle_order_status_change(order, new_status, note_msg=note_msg)
