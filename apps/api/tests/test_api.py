from __future__ import annotations

import base64
from io import BytesIO
from unittest import skipIf
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient

from apps.api.tests.utils import (
    create_user,
    auth_client,
    create_product,
    create_shipping_method,
    create_event,
)


class ApiSmokeTests(APITestCase):
    def test_health_and_config(self):
        r = self.client.get("/api/v1/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data.get("status"), "ok")

        r = self.client.get("/api/v1/config")
        self.assertEqual(r.status_code, 200)
        self.assertIn("currency", r.data)


class AuthTests(APITestCase):
    def test_register_login_and_me(self):
        email = "testuser@example.com"
        password = "Passw0rd!"
        r = self.client.post("/api/v1/auth/register/", {"email": email, "password": password})
        self.assertEqual(r.status_code, 201)

        r = self.client.post("/api/v1/auth/token/", {"email": email, "password": password})
        self.assertEqual(r.status_code, 200)
        token = r.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/users/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["email"].lower(), email.lower())

    def test_password_reset_flow(self):
        user = create_user()
        # Request reset (always returns sent)
        r = self.client.post("/api/v1/auth/password/reset/", {"email": user.email})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data.get("sent"))

        # Confirm with generated token
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        new_pw = "N3wPassw0rd!"
        r = self.client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"uid": uid, "token": token, "new_password": new_pw},
        )
        self.assertEqual(r.status_code, 200)


class CatalogueTests(APITestCase):
    def test_products_list_and_retrieve(self):
        p = create_product(price=10)
        r = self.client.get("/api/v1/products")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data.get("count"), 1)

        r = self.client.get(f"/api/v1/products/{p.id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], p.id)

        r = self.client.get(f"/api/v1/products/{p.slug}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], p.id)


class ShippingTests(APITestCase):
    def test_shipping_methods(self):
        m = create_shipping_method(price=0)
        r = self.client.get("/api/v1/shipping/methods")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(i["code"] == m.code for i in r.data))


class BasketTests(APITestCase):
    def test_guest_basket_and_lines(self):
        p = create_product(price=15)
        # Create basket
        r = self.client.post("/api/v1/baskets")
        self.assertEqual(r.status_code, 201)
        basket_id = r.data["cart_id"]

        # Add line
        r = self.client.post(f"/api/v1/baskets/{basket_id}/lines", {"product_id": p.id, "quantity": 2}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["lines"][0]["quantity"], 2)

        # Update quantity
        line_id = r.data["lines"][0]["id"]
        r = self.client.patch(f"/api/v1/baskets/{basket_id}/lines/{line_id}", {"quantity": 1}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["lines"][0]["quantity"], 1)

        # Delete line
        r = self.client.delete(f"/api/v1/baskets/{basket_id}/lines/{line_id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["lines"]), 0)

    def test_apply_invalid_voucher(self):
        # Create basket and try invalid code
        r = self.client.post("/api/v1/baskets")
        basket_id = r.data["cart_id"]
        r = self.client.post(f"/api/v1/baskets/{basket_id}/apply-voucher", {"code": "NOPE"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_merge_guest_into_user(self):
        p = create_product(price=10)
        guest = self.client.post("/api/v1/baskets").data["cart_id"]
        self.client.post(f"/api/v1/baskets/{guest}/lines", {"product_id": p.id, "quantity": 1}, format="json")

        client = APIClient()
        auth_client(client)
        r = client.post("/api/v1/baskets/merge", {"source_cart_id": guest}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["lines"]), 1)


class CheckoutTests(APITestCase):
    def test_paynow_checkout_end_to_end(self):
        # Setup product and shipping
        p = create_product(price=20)
        m = create_shipping_method(price=0, is_self_collect=True)

        # Basket create and add
        basket_id = self.client.post("/api/v1/baskets").data["cart_id"]
        self.client.post(f"/api/v1/baskets/{basket_id}/lines", {"product_id": p.id, "quantity": 1}, format="json")

        # Upload proof
        img = SimpleUploadedFile("proof.jpg", b"fake-image-bytes", content_type="image/jpeg")
        r = self.client.post("/api/v1/checkout/payment/paynow-proof", {"basket_id": basket_id, "donation": 2, "payment_proof": img})
        self.assertEqual(r.status_code, 201)
        temp_key = r.data["temp_key"]

        # Place order
        r = self.client.post("/api/v1/checkout/place-order", {"basket_id": basket_id, "temp_key": temp_key, "shipping_method_code": m.code})
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("number", r.data)


try:
    import weasyprint  # noqa
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False


class OrdersTests(APITestCase):
    def test_orders_list_and_receipt(self):
        # Place an order under a logged-in user
        client = APIClient()
        auth_client(client)

        p = create_product(price=30)
        m = create_shipping_method(price=0)

        basket_id = client.post("/api/v1/baskets").data["cart_id"]
        client.post(f"/api/v1/baskets/{basket_id}/lines", {"product_id": p.id, "quantity": 1}, format="json")
        img = SimpleUploadedFile("proof.jpg", b"fake-image-bytes", content_type="image/jpeg")
        temp_key = client.post("/api/v1/checkout/payment/paynow-proof", {"basket_id": basket_id, "payment_proof": img}).data["temp_key"]
        order = client.post("/api/v1/checkout/place-order", {"basket_id": basket_id, "temp_key": temp_key, "shipping_method_code": m.code}).data

        # List orders
        r = client.get("/api/v1/orders")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data.get("count"), 1)

        # Receipt (skip if WeasyPrint not available)
        number = order["number"]
        if WEASYPRINT_AVAILABLE:
            r = client.get(f"/api/v1/orders/{number}/receipt")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r["Content-Type"], "application/pdf")


class RefundsTests(APITestCase):
    def test_create_and_detail_authorization(self):
        # Create
        payload = {
            "name": "Buyer",
            "email": "buyer@example.com",
            "paynow_phone": "12345678",
            "order_number": "9999",
            "amount": "10.00",
            "reason": "Test",
        }
        r = self.client.post("/api/v1/refunds", payload, format="json")
        self.assertEqual(r.status_code, 201)
        rid = r.data["id"]

        # Non-owner access forbidden
        client = APIClient()
        auth_client(client, email="notbuyer@example.com")
        r = client.get(f"/api/v1/refunds/{rid}")
        self.assertEqual(r.status_code, 403)

        # Owner (by email) can access
        client = APIClient()
        auth_client(client, email="buyer@example.com")
        r = client.get(f"/api/v1/refunds/{rid}")
        self.assertEqual(r.status_code, 200)


class EventsTests(APITestCase):
    def test_register(self):
        event = create_event(max_participants=5)
        payload = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "quantity": 2,
        }
        r = self.client.post(f"/api/v1/events/{event.id}/register", payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        # Duplicate email should fail
        r = self.client.post(f"/api/v1/events/{event.id}/register", payload, format="json")
        self.assertEqual(r.status_code, 400)
