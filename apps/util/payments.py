import datetime
from decimal import Decimal
from django.conf import settings
from oscar.core.loading import get_model, get_class


Order = get_model("order", "Order")
PaymentEvent = get_model("order", "PaymentEvent")
PaymentEventQuantity = get_model("order", "PaymentEventQuantity")
PaymentEventType = get_model("order", "PaymentEventType")
InvalidOrderStatus = get_class("order.exceptions", "InvalidOrderStatus")


class PaymentConfirmationError(Exception):
    pass


def confirm_paynow_payment(order: "Order", amount: Decimal) -> None:
    """
    Mark the given order as paid via PayNow (auto-verified),
    mirroring the webhook behaviour.
    """
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))

    if order.total_incl_tax_with_donation != amount:
        raise PaymentConfirmationError(
            f"Amount mismatch. Expected: SGD {order.total_incl_tax_with_donation}. Received: SGD {amount}"
        )

    try:
        payment_verified_event_type = PaymentEventType._default_manager.get(
            code="paynow-auto-verified"
        )

        # If already marked as paid, don't duplicate
        if order.payment_events.filter(
            event_type__code__in=["paynow-auto-verified", "paynow-verified"]
        ).exists():
            return

        order.set_status(settings.PAYMENT_AUTO_CONFIRMED_STATUS)
        order.save()

        verified_event = order.payment_events.create(
            amount=0,  # amount already debited at source
            reference=order.sources.first().reference if order.sources.exists() else "",
            event_type=payment_verified_event_type,
            date_created=datetime.datetime.now(),
        )

        # Mirror quantities from the processing event if present
        try:
            processing_event = order.payment_events.get(
                event_type__name="paynow-processing"
            )

            PaymentEventQuantity._default_manager.bulk_create(
                [
                    PaymentEventQuantity(
                        event=verified_event, line=peq.line, quantity=peq.quantity
                    )
                    for peq in PaymentEventQuantity._default_manager.filter(
                        event=processing_event
                    )
                ]
            )

        except PaymentEvent.DoesNotExist:
            if settings.GLOBAL_PAYNOW_REQUIRED:
                raise PaymentConfirmationError("PayNow payment event is unavailable.")

    except InvalidOrderStatus as e:
        raise PaymentConfirmationError(f"Failed to confirm payment: {str(e)}") from e

