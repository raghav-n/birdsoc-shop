from __future__ import annotations

from decimal import Decimal
import jwt
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient

from apps.api.tests.utils import auth_client, create_product, create_shipping_method


class VerifyPaymentWebhookTests(APITestCase):
    def _place_order(self):
        client = APIClient()
        auth_client(client)
        create_shipping_method(price=0)
        p = create_product(price=40)
        basket_id = client.post("/api/v1/baskets").data["cart_id"]
        client.post(
            f"/api/v1/baskets/{basket_id}/lines", {"product_id": p.id, "quantity": 1}, format="json"
        )
        img = SimpleUploadedFile("proof.jpg", b"fake", content_type="image/jpeg")
        temp_key = client.post(
            "/api/v1/checkout/payment/paynow-proof", {"basket_id": basket_id, "payment_proof": img, "donation": 3}
        ).data["temp_key"]
        order = client.post(
            "/api/v1/checkout/place-order", {"basket_id": basket_id, "temp_key": temp_key}
        ).data
        return order

    def test_happy_path_and_idempotency(self):
        order = self._place_order()
        amount = str(Decimal(str(order["total_incl_tax"])) + Decimal(str(order["donation_amount"])))
        payload = {"order_number": order["number"], "amount": amount}
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

        # First call succeeds
        r = self.client.post(
            "/api/verify-payment/",
            data={},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("success", r.json())

        # Second call returns already marked / idempotency behavior
        r = self.client.post(
            "/api/verify-payment/",
            data={},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r.status_code, 400)

    def test_errors_missing_auth_invalid_order_and_amount_mismatch(self):
        # Missing auth
        r = self.client.post("/api/verify-payment/", data={})
        self.assertEqual(r.status_code, 401)

        # Invalid order
        bad = jwt.encode({"order_number": "NOPE", "amount": "1.00"}, settings.JWT_SECRET, algorithm="HS256")
        r = self.client.post("/api/verify-payment/", data={}, HTTP_AUTHORIZATION=f"Bearer {bad}")
        self.assertEqual(r.status_code, 404)

        # Real order with wrong amount
        order = self._place_order()
        wrong = jwt.encode({"order_number": order["number"], "amount": "0.01"}, settings.JWT_SECRET, algorithm="HS256")
        r = self.client.post("/api/verify-payment/", data={}, HTTP_AUTHORIZATION=f"Bearer {wrong}")
        self.assertEqual(r.status_code, 400)

    def test_invalid_token(self):
        order = self._place_order()
        bad_token = jwt.encode({"order_number": order["number"], "amount": "1.00"}, "wrong", algorithm="HS256")
        r = self.client.post("/api/verify-payment/", data={}, HTTP_AUTHORIZATION=f"Bearer {bad_token}")
        self.assertEqual(r.status_code, 401)

