from __future__ import annotations

from decimal import Decimal
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.api.tests.utils import create_product, create_shipping_method


class CheckoutExtraTests(APITestCase):
    def _basket_with_line(self, price=10):
        p = create_product(price=price)
        basket_id = self.client.post("/api/v1/baskets").data["cart_id"]
        self.client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": p.id, "quantity": 1},
            format="json",
        )
        return basket_id

    def test_checkout_email_and_address_endpoints(self):
        basket_id = self._basket_with_line()
        # Missing
        r = self.client.post("/api/v1/checkout/email", {}, format="json")
        self.assertEqual(r.status_code, 400)
        # Invalid email
        r = self.client.post(
            "/api/v1/checkout/email",
            {"basket_id": basket_id, "email": "bad"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        # OK
        r = self.client.post(
            "/api/v1/checkout/email",
            {"basket_id": basket_id, "email": "guest@example.com"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

        # Address missing/ok
        r = self.client.post("/api/v1/checkout/address", {}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(
            "/api/v1/checkout/address",
            {"basket_id": basket_id, "address": {"line1": "123 Main"}},
            format="json",
        )
        self.assertEqual(r.status_code, 200)

    def test_place_order_error_paths(self):
        # Missing basket
        r = self.client.post("/api/v1/checkout/place-order", {}, format="json")
        self.assertEqual(r.status_code, 400)

        # Empty basket
        empty_id = self.client.post("/api/v1/baskets").data["cart_id"]
        r = self.client.post(
            "/api/v1/checkout/place-order", {"basket_id": empty_id}, format="json"
        )
        self.assertEqual(r.status_code, 400)

        basket_id = self._basket_with_line(price=12)
        # Invalid temp key and no upload
        r = self.client.post(
            "/api/v1/checkout/place-order",
            {"basket_id": basket_id, "temp_key": "does-not-exist"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

        # Bad donation
        img = SimpleUploadedFile("proof.jpg", b"bytes", content_type="image/jpeg")
        r = self.client.post(
            "/api/v1/checkout/place-order",
            {"basket_id": basket_id, "payment_proof": img, "donation": "bad"},
        )
        self.assertEqual(r.status_code, 400)

        # Invalid shipping method code
        img = SimpleUploadedFile("proof.jpg", b"bytes2", content_type="image/jpeg")
        r = self.client.post(
            "/api/v1/checkout/place-order",
            {
                "basket_id": basket_id,
                "payment_proof": img,
                "shipping_method_code": "nope",
            },
        )
        self.assertEqual(r.status_code, 400)

    def test_place_order_with_direct_upload_and_donation_reflected(self):
        create_shipping_method(price=0, is_self_collect=True)
        basket_id = self._basket_with_line(price=25)
        img = SimpleUploadedFile("proof.jpg", b"image-bytes", content_type="image/jpeg")
        r = self.client.post(
            "/api/v1/checkout/place-order",
            {"basket_id": basket_id, "payment_proof": img, "donation": 5},
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["donation_amount"], 5)
        # Ensure sources present and amount includes donation
        self.assertTrue(r.data["sources"])
        from decimal import Decimal as D

        total_incl_tax = D(str(r.data["total_incl_tax"]))
        expected = total_incl_tax + D("5")
        amounts = [D(str(s["amount_debited"])) for s in r.data["sources"]]
        self.assertTrue(any(a == expected for a in amounts))
