import operator
from decimal import Decimal as D, Decimal

from oscar.apps.offer.abstract_models import AbstractBenefit as CoreAbstractBenefit
from oscar.core.loading import get_class


class Benefit(CoreAbstractBenefit):
    # pylint: disable=W0622
    def get_applicable_lines(self, offer, basket, range=None):
        """
        Return the basket lines that are available to be discounted

        :basket: The basket
        :range: The range of products to use for filtering.  The fixed-price
                benefit ignores its range and uses the condition range
        """
        unit_price = get_class("offer.utils", "unit_price")
        if range is None:
            range = self.range
        line_tuples = []
        for line in basket.all_lines():
            product = line.product

            if not range.contains_product(product) or not self.can_apply_benefit(line):
                continue

            price = unit_price(offer, line) - Decimal(
                line._discount_excl_tax / line.quantity
            )
            if not price:
                # Avoid zero price products
                continue
            line_tuples.append((price, line))

        # We sort lines to be cheapest first to ensure consistent applications
        return sorted(line_tuples, key=operator.itemgetter(0))

    def apply(self, basket, condition, offer):
        """
        Apply the benefit to the basket

        This override ensures the result is always returned and properly parsed
        """
        result = super().apply(basket, condition, offer)

        # Make sure we return a valid result even if the benefit didn't impact anything
        if not result:
            from oscar.apps.offer.results import BasketDiscount

            return BasketDiscount(basket, Decimal("0.00"))

        return result

    def clean(self):
        """
        Clean the benefit options.

        This override ensures that the range is always set when using certain benefit types.
        """
        super().clean()

        # If using certain benefit types, ensure range is set
        if self.type in ["ValueDollar", "PercentageDiscount"] and not self.range:
            from django.core.exceptions import ValidationError

            raise ValidationError(
                {"range": "This benefit type requires a product range to be specified"}
            )


class Discount20Cap10(Benefit):
    class Meta:
        proxy = True

    name = description = "Discount of 20%, capped at $10"

    def apply(self, basket, condition, offer):
        from oscar.apps.offer.benefits import apply_discount

        line_tuples = self.get_applicable_lines(offer, basket)

        discount_percent = D("20.0")
        discount = D(0)
        max_discount = D("10.0")

        total_discountable = D(
            sum([price * line.quantity for (price, line) in line_tuples])
        )

        total_discount = min(
            (discount_percent / D("100.0")) * total_discountable, max_discount
        )

        if total_discount >= max_discount:
            discount_percent = max_discount / total_discountable * D("100.0")

        for idx, (price, line) in enumerate(line_tuples):
            quantity_affected = line.quantity

            if idx == len(line_tuples) - 1:
                line_discount = total_discount - discount
            else:
                line_discount = self.round(
                    discount_percent / D("100.0") * price * int(quantity_affected),
                    basket.currency,
                )

            apply_discount(line, line_discount, quantity_affected, offer)
            discount += line_discount

        return BasketDiscount(discount)


from oscar.apps.offer.models import *
