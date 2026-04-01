from django.conf import settings
from django.db import models


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


from oscar.apps.checkout.models import *
