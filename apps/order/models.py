import datetime
import secrets
import uuid

from django.conf import settings
from django.db import models
from django.template.loader import render_to_string
from django.utils import timezone

from oscar.apps.order.abstract_models import AbstractOrder
from oscar.apps.order.abstract_models import AbstractPaymentEvent
from oscar.core.loading import get_class
from weasyprint import Document, HTML
from decimal import Decimal

Repository = get_class("shipping.repository", "Repository")
COLLECTION_ACCESS_NAMESPACE = uuid.UUID("3f170217-46db-4c4b-8d16-5ea76568e7e4")


class Order(AbstractOrder):
    collection_location = models.CharField(max_length=255, null=True, blank=True)
    collection_date = models.DateField(null=True, blank=True)
    donation_amount = models.PositiveIntegerField(null=False, default=0)

    receipt_template = "pdf/receipt.html"

    def get_shipping_method(self):
        """
        Return the selected shipping method instance from this checkout session

        The shipping address is passed as we need to check that the method
        stored in the session is still valid for the shipping address.
        """
        methods = Repository().get_available_shipping_methods(basket=None)
        for method in methods:
            if method.name == self.shipping_method:
                return method

    def get_items_ordered(self):
        items = {}
        for line in self.lines.all():
            desc = line.description
            existing_item_for_line = items.get("desc")
            if (
                existing_item_for_line
                and existing_item_for_line["price"] == line.unit_price_excl_tax
            ):
                items[desc]["quantity"] += line.quantity
            else:
                items[desc] = {}
                items[desc]["quantity"] = line.quantity
                items[desc]["price"] = line.unit_price_excl_tax
                items[desc]["total"] = line.line_price_before_discounts_excl_tax

        for desc in items.keys():
            items[desc]["price"] = items[desc]["total"] / items[desc]["quantity"]

        return [{**{"desc": desc}, **details} for desc, details in items.items()]

    def get_receipt(self) -> Document:
        context = {
            "user_name": self.user.get_full_name(),
            "user_email": self.user.email,
            "year": self.date_placed.year,
            "order_number": f"{settings.ORDER_PREFIX}{self.number}",
            "date": timezone.now().date().strftime("%d %b %Y"),
            "subtotal": self.total_before_discounts_excl_tax_with_donation,
            "gst": self.total_tax,
            "total": self.total_incl_tax_with_donation,
            "discount": self.total_discount_incl_tax,
            "payment_method": "/".join(
                self.sources.values_list("source_type__name", flat=True)
            ),
            "total_paid": sum(self.sources.values_list("amount_debited", flat=True)),
            "items": self.get_items_ordered(),
            "use_currency": self.currency,
            "donation_amount": self.donation_amount,
        }
        context["balance_due"] = context["total"] - context["total_paid"]
        template_str = render_to_string(self.receipt_template, context=context)

        return HTML(string=template_str).render()

    def get_receipt_as_pdf(self) -> bytes:
        receipt_as_pdf = self.get_receipt().write_pdf()
        with open(
            settings.PROJECT_DIR / f"receipts/{self.number}.pdf", "wb"
        ) as pdf_file:
            pdf_file.write(receipt_as_pdf)
        return receipt_as_pdf

    @property
    def total_incl_tax_with_donation(self):
        return self.total_incl_tax + self.donation_amount

    @property
    def collection_access_id(self):
        if not self.number or not self.date_placed:
            return None
        placed_at = self.date_placed.astimezone(datetime.timezone.utc).isoformat(
            timespec="microseconds"
        )
        return str(uuid.uuid5(COLLECTION_ACCESS_NAMESPACE, f"{self.number}:{placed_at}"))

    def has_valid_collection_access_id(self, candidate):
        if not candidate:
            return False
        try:
            normalized_candidate = str(uuid.UUID(str(candidate)))
        except (TypeError, ValueError, AttributeError):
            return False
        return secrets.compare_digest(
            normalized_candidate, self.collection_access_id or ""
        )

    @property
    def total_before_discounts_excl_tax_with_donation(self):
        return self.total_before_discounts_excl_tax + self.donation_amount

    @property
    def total_discount(self):
        """
        Returns the total discount amount applied to this order
        """
        # Check for discounts in the related OrderDiscounts, if any
        try:
            from oscar.apps.offer.models import OrderDiscount

            discounts = OrderDiscount.objects.filter(order=self)
            return sum(d.amount for d in discounts)
        except ImportError:
            # If OrderDiscount doesn't exist, calculate from line discounts
            return sum(
                (line.line_price_before_discounts_incl_tax - line.line_price_incl_tax)
                for line in self.lines.all()
            )

    @property
    def discount_percentage(self):
        """
        Returns the discount as a percentage of the original price
        """
        if self.total_discount == Decimal("0.00"):
            return Decimal("0.00")

        # Calculate the original total before discounts
        original_total = self.total_incl_tax + self.total_discount

        if original_total > Decimal("0.00"):
            return (self.total_discount / original_total) * Decimal("100.0")
        return Decimal("0.00")

    @property
    def has_discounts(self):
        """
        Returns True if this order has any discounts applied
        """
        return self.total_discount > Decimal("0.00")

    @property
    def display_discount_info(self):
        """
        Returns a string with discount information for display
        """
        if not self.has_discounts:
            return ""

        return f"Discount: ${self.total_discount:.2f} ({self.discount_percentage:.1f}%)"


class SalesPeriod(models.Model):
    name = models.CharField(max_length=255)
    start = models.DateTimeField()
    end = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start"]

    def __str__(self):
        return self.name


from oscar.apps.order.models import *
