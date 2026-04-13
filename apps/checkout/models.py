from django.conf import settings
from django.db import models
from django.utils import timezone


class PendingCheckout(models.Model):
    """
    Stores checkout intent when a user reaches the payment step.
    If the user makes payment but leaves before uploading proof / pressing
    submit, this record survives so an admin can follow up.
    Deleted automatically when the order is successfully placed.
    """

    basket_id = models.PositiveIntegerField()
    email = models.EmailField(blank=True, default="")
    reference = models.CharField(max_length=64)
    shipping_method_code = models.CharField(max_length=128, blank=True, default="")
    donation = models.PositiveIntegerField(default=0)
    basket_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Frozen basket contents and total at time of checkout.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "checkout"
        verbose_name = "Pending Checkout"
        verbose_name_plural = "Pending Checkouts"

    def __str__(self):
        return f"Pending #{self.reference} (basket {self.basket_id})"


class UnmatchedPayment(models.Model):
    """
    Tracks payment webhooks that could not be matched to an order or pending
    checkout so duplicate webhook deliveries do not trigger duplicate alerts.
    """

    order_number = models.CharField(max_length=64)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    occurrence_count = models.PositiveIntegerField(default=1)
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    notification_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "checkout"
        verbose_name = "Unmatched Payment"
        verbose_name_plural = "Unmatched Payments"
        constraints = [
            models.UniqueConstraint(
                fields=["order_number", "amount"],
                name="checkout_unmatched_payment_order_amount_uniq",
            )
        ]

    def __str__(self):
        return f"Unmatched payment #{self.order_number} ({self.amount})"


from oscar.apps.checkout.models import *
