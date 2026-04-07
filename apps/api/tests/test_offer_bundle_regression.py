from __future__ import annotations

from decimal import Decimal

from django.utils.crypto import get_random_string
from oscar.core.loading import get_class, get_model
from rest_framework.test import APITestCase

from apps.api.tests.utils import create_product


Basket = get_model("basket", "Basket")
ConditionalOffer = get_model("offer", "ConditionalOffer")
Condition = get_model("offer", "Condition")
Benefit = get_model("offer", "Benefit")
Range = get_model("offer", "Range")
RangeProduct = get_model("offer", "RangeProduct")
Applicator = get_class("offer.applicator", "Applicator")
Selector = get_class("partner.strategy", "Selector")


class OfferBundleRegressionTests(APITestCase):
    def test_fixed_price_coverage_offer_keeps_full_discount_across_repeated_sets(self):
        products = [
            create_product(
                title=f"Sticker {idx} {get_random_string(6)}",
                price=Decimal("2.70"),
                num_in_stock=20,
            )
            for idx in range(4)
        ]

        offer_range = Range._default_manager.create(
            name=f"Sticker Bundle {get_random_string(6)}"
        )
        for product in products:
            RangeProduct._default_manager.create(range=offer_range, product=product)

        condition = Condition._default_manager.create(
            type=Condition.COVERAGE,
            range=offer_range,
            value=Decimal("4"),
        )
        benefit = Benefit._default_manager.create(
            type=Benefit.FIXED_PRICE,
            value=Decimal("10.00"),
        )
        ConditionalOffer._default_manager.create(
            name=f"Sticker Offer {get_random_string(6)}",
            offer_type=ConditionalOffer.SITE,
            condition=condition,
            benefit=benefit,
        )

        basket = Basket._default_manager.create(status=Basket.OPEN)
        basket.strategy = Selector().strategy()
        for product in products:
            basket.add_product(product, quantity=5)

        Applicator().apply(basket, None)

        self.assertEqual(basket.total_excl_tax, Decimal("50.00"))
        self.assertEqual(
            sum(discount["discount"] for discount in basket.offer_discounts),
            Decimal("4.00"),
        )
