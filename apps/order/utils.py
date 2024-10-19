from django.conf import settings
from oscar.apps.order.utils import OrderNumberGenerator as CoreOrderNumberGenerator
from oscar.apps.order.utils import OrderDispatcher as CoreOrderDispatcher


class OrderNumberGenerator(CoreOrderNumberGenerator):

    def order_number(self, basket=None):
        """
        Return an order number for a given basket
        """
        return settings.BASE_ORDER_NUMBER + basket.id


class OrderDispatcher(CoreOrderDispatcher):
    PAYMENT_CONFIRMED_EVENT_CODE = "PAYMENT_CONFIRMED"
    COLLECTION_INFO_SENT_EVENT_CODE = "COLLECTION_INFO_SENT"

    def send_payment_confirmed_email_for_user(
        self, order, extra_context, attachments=None
    ):
        event_code = self.PAYMENT_CONFIRMED_EVENT_CODE
        messages = self.dispatcher.get_messages(event_code, extra_context)

        if attachments is None:
            attachments = []

        attachments.append(
            [
                f"receipt-{settings.ORDER_PREFIX}{order.number}.pdf",
                order.get_receipt_as_pdf(),
                "application/pdf",
            ]
        )
        self.dispatch_order_messages(
            order, messages, event_code, attachments=attachments
        )

    def send_collection_info_sent_email_for_user(self, order, extra_context):
        event_code = self.COLLECTION_INFO_SENT_EVENT_CODE
        messages = self.dispatcher.get_messages(event_code, extra_context)

        self.dispatch_order_messages(order, messages, event_code)
