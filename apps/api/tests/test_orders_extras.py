from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils.crypto import get_random_string
from oscar.core.loading import get_model
from rest_framework.test import APITestCase, APIClient

from apps.api.tests.utils import auth_client, create_product, create_shipping_method


ConditionalOffer = get_model("offer", "ConditionalOffer")
Condition = get_model("offer", "Condition")
Benefit = get_model("offer", "Benefit")
Range = get_model("offer", "Range")
RangeProduct = get_model("offer", "RangeProduct")


class OrdersExtraTests(APITestCase):
    def _place_order_for(self, client: APIClient):
        p = create_product(price=18)
        m = create_shipping_method(price=0)
        basket_id = client.post("/api/v1/baskets").data["cart_id"]
        client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": p.id, "quantity": 1},
            format="json",
        )
        img = SimpleUploadedFile("proof.jpg", b"fake-bytes", content_type="image/jpeg")
        temp_key = client.post(
            "/api/v1/checkout/payment/paynow-proof",
            {"basket_id": basket_id, "payment_proof": img},
        ).data["temp_key"]
        order = client.post(
            "/api/v1/checkout/place-order",
            {
                "basket_id": basket_id,
                "temp_key": temp_key,
                "shipping_method_code": m.code,
            },
        ).data
        return order

    def test_retrieve_forbidden_for_other_user(self):
        c1 = APIClient()
        auth_client(c1, email="o1@example.com")
        order = self._place_order_for(c1)

        c2 = APIClient()
        auth_client(c2, email="o2@example.com")
        r = c2.get(f"/api/v1/orders/{order['number']}")
        # Not in queryset for user => 404
        self.assertEqual(r.status_code, 404)

    def test_retrieve_allows_anonymous_access_with_valid_id(self):
        client = APIClient()
        auth_client(client, email="anon-access@example.com")
        order = self._place_order_for(client)

        guest = APIClient()
        response = guest.get(
            f"/api/v1/orders/{order['number']}",
            {"id": order["access_id"]},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["number"], order["number"])
        self.assertEqual(response.data["access_id"], order["access_id"])

    def test_retrieve_requires_owner_or_valid_id(self):
        client = APIClient()
        auth_client(client, email="no-token@example.com")
        order = self._place_order_for(client)

        guest = APIClient()
        response = guest.get(f"/api/v1/orders/{order['number']}")
        self.assertEqual(response.status_code, 404)

        response = guest.get(f"/api/v1/orders/{order['number']}", {"id": "not-a-uuid"})
        self.assertEqual(response.status_code, 404)

    def test_receipt_allows_anonymous_access_with_valid_id(self):
        client = APIClient()
        auth_client(client, email="receipt-access@example.com")
        order = self._place_order_for(client)

        guest = APIClient()
        with patch("apps.order.models.Order.get_receipt_as_pdf", return_value=b"%PDF-fake"):
            response = guest.get(
                f"/api/v1/orders/{order['number']}/receipt",
                {"id": order["access_id"]},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_retrieve_includes_pre_discount_totals_and_discounts(self):
        client = APIClient()
        auth_client(client, email="discounted@example.com")

        product = create_product(
            title=f"Discounted Product {get_random_string(6)}",
            price=Decimal("20.00"),
        )
        offer_range = Range._default_manager.create(
            name=f"Discount Range {get_random_string(6)}"
        )
        RangeProduct._default_manager.create(range=offer_range, product=product)
        condition = Condition._default_manager.create(
            type=Condition.COUNT,
            range=offer_range,
            value=1,
        )
        benefit = Benefit._default_manager.create(
            type=Benefit.PERCENTAGE,
            value=Decimal("20.00"),
            range=offer_range,
        )
        ConditionalOffer._default_manager.create(
            name=f"20% Off {get_random_string(6)}",
            offer_type=ConditionalOffer.SITE,
            condition=condition,
            benefit=benefit,
        )

        shipping_method = create_shipping_method(price=Decimal("0.00"))
        basket_id = client.post("/api/v1/baskets").data["cart_id"]
        client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": product.id, "quantity": 1},
            format="json",
        )

        image = SimpleUploadedFile("proof.jpg", b"fake-bytes", content_type="image/jpeg")
        temp_key = client.post(
            "/api/v1/checkout/payment/paynow-proof",
            {"basket_id": basket_id, "payment_proof": image},
        ).data["temp_key"]
        placed = client.post(
            "/api/v1/checkout/place-order",
            {
                "basket_id": basket_id,
                "temp_key": temp_key,
                "shipping_method_code": shipping_method.code,
            },
        )
        self.assertEqual(placed.status_code, 201, placed.data)

        number = placed.data["number"]
        response = client.get(f"/api/v1/orders/{number}")
        self.assertEqual(response.status_code, 200, response.data)

        data = response.data
        self.assertEqual(Decimal(str(data["basket_total_before_discounts_incl_tax"])), Decimal("20.00"))
        self.assertEqual(Decimal(str(data["basket_total_incl_tax"])), Decimal("16.00"))
        self.assertEqual(Decimal(str(data["total_discount_incl_tax"])), Decimal("4.00"))
        self.assertEqual(len(data["basket_discounts"]), 1)
        self.assertEqual(data["basket_discounts"][0]["name"][:7], "20% Off")
        self.assertEqual(Decimal(str(data["basket_discounts"][0]["amount"])), Decimal("4.00"))
        self.assertIsNone(data["lines"][0]["product_image"])
        self.assertEqual(Decimal(str(data["lines"][0]["line_price_before_discounts_incl_tax"])), Decimal("20.00"))
        self.assertEqual(Decimal(str(data["lines"][0]["line_price_incl_tax"])), Decimal("16.00"))
