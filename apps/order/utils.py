from django.conf import settings
from django.db import transaction
from oscar.apps.order.utils import OrderNumberGenerator as CoreOrderNumberGenerator
from oscar.apps.order.utils import OrderDispatcher as CoreOrderDispatcher
from oscar.core.loading import get_model


Order = get_model("order", "Order")


class OrderDeletionNotAllowed(Exception):
    pass


@transaction.atomic
def delete_order_and_release_allocations(order):
    locked_order = (
        Order._default_manager.select_for_update()
        .prefetch_related("lines__stockrecord")
        .get(pk=order.pk)
    )

    if locked_order.status == settings.COLLECTED_STATUS:
        raise OrderDeletionNotAllowed(
            f"Order {locked_order.number} is already {settings.COLLECTED_STATUS!r} and cannot be deleted."
        )

    allocations_released = 0
    for line in locked_order.lines.select_related("stockrecord").all():
        if line.can_track_allocations and line.num_allocated:
            allocations_released += line.num_allocated
            line.cancel_allocation(line.num_allocated)

    deleted_count, _ = locked_order.delete()
    return allocations_released, deleted_count


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
        try:
            self.dispatch_order_messages(
                order, messages, event_code, attachments=attachments
            )
        except Exception:
            pass

    def send_collection_info_sent_email_for_user(self, order, extra_context):
        event_code = self.COLLECTION_INFO_SENT_EVENT_CODE
        messages = self.dispatcher.get_messages(event_code, extra_context)

        try:
            self.dispatch_order_messages(order, messages, event_code)
        except Exception:
            pass
