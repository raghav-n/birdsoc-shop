from decimal import Decimal as D

from oscar.apps.offer.models import *


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

        if (discount_percent / D("100.0")) * total_discountable > max_discount:
            discount_percent = (max_discount / total_discountable) * D("100.0")

        for price, line in line_tuples:
            quantity_affected = line.quantity

            line_discount = self.round(
                discount_percent / D("100.0") * price * int(quantity_affected),
                basket.currency,
            )

            apply_discount(line, line_discount, quantity_affected, offer)
            discount += line_discount

        return BasketDiscount(discount)
