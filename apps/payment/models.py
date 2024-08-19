from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.urls import reverse
from django.utils import timezone
from oscar.apps.payment.abstract_models import AbstractSource
from oscar.core.loading import get_model


def get_payment_proof_path(instance: "Source", filename: str) -> str:
    """Returns default image filename where images are stored after being uploaded"""
    return f"payments/{instance.reference}_{filename}"

class Source(AbstractSource):
    payment_proof = models.ImageField(null=True, upload_to=get_payment_proof_path)
    payment_verified = models.BooleanField(null=False, default=False)
    payment_verified_by = models.ForeignKey(to=get_user_model(), on_delete=models.SET_NULL, null=True)
    payment_verified_on = models.DateTimeField(null=True)

    def verify(self, user) -> bool:
        PaymentEvent = get_model("order", "PaymentEvent")
        PaymentEventType = get_model("order", "PaymentEventType")
        PaymentEventQuantity = get_model("order", "PaymentEventQuantity")

        self.payment_verified = True
        self.payment_verified_by = user
        self.payment_verified_on = timezone.now()
        self.save()

        payment_verified_event_type = PaymentEventType._default_manager.get(code="paynow-verified")

        try:
            order = self.order
            processing_event = order.payment_events.get(event_type__name="paynow-processing")
            verified_event = PaymentEvent(
                order=order,
                amount=0,
                reference=self.reference,
                event_type=payment_verified_event_type,
            )
            verified_event.save()

            PaymentEventQuantity._default_manager.bulk_create(
                [
                    PaymentEventQuantity(event=verified_event, line=peq.line, quantity=peq.quantity) for peq in
                    PaymentEventQuantity._default_manager.filter(event=processing_event)
                ]
            )

        except PaymentEvent.DoesNotExist:
            if settings.GLOBAL_PAYNOW_REQUIRED:
                raise ValueError("PayNow payment event is unavailable.")

        return True

from oscar.apps.payment.models import *