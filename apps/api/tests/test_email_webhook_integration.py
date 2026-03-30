"""
End-to-end integration tests that simulate the Apps Script email→webhook pipeline.

These tests:
1. Create orders / event registrations via the API
2. Build a realistic PayNow email body
3. Parse it with the same regexes the Apps Script uses
4. Generate a JWT exactly as the Apps Script would
5. POST to the webhook endpoint and verify payment is confirmed
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import time
from base64 import urlsafe_b64encode
from decimal import Decimal

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from oscar.core.loading import get_model
from rest_framework.test import APITestCase, APIClient


from apps.api.tests.utils import (
    auth_client,
    create_product,
    create_shipping_method,
)

Order = get_model("order", "Order")

# ---------------------------------------------------------------------------
# Regex patterns identical to the Apps Script defaults
# ---------------------------------------------------------------------------
ORDER_REGEX = r"OTHR-MER-([A-Za-z0-9-]+)"
AMOUNT_REGEX = r"S\$([\d.]+)"
EVENT_REG_REF_REGEX = r"(OBD25-[A-Za-z0-9-]+)"  # kept for _parse_and_call_webhook


# ---------------------------------------------------------------------------
# JWT helper — mirrors generateJWTForPayload() in Apps Script
# ---------------------------------------------------------------------------
def _b64url(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode()


def apps_script_jwt(payload: dict, secret: str | None = None) -> str:
    """Produce an HS256 JWT the same way the Apps Script does."""
    secret = secret or settings.JWT_SECRET
    if "exp" not in payload:
        payload["exp"] = int(time.time()) + 60
    header = {"alg": "HS256", "typ": "JWT"}
    enc_header = _b64url(json.dumps(header).encode())
    enc_payload = _b64url(json.dumps(payload).encode())
    to_sign = f"{enc_header}.{enc_payload}"
    sig = hmac.new(secret.encode(), to_sign.encode(), hashlib.sha256).digest()
    return f"{to_sign}.{_b64url(sig)}"


# ---------------------------------------------------------------------------
# Email body templates
# ---------------------------------------------------------------------------
PAYNOW_EMAIL_TEMPLATE = (
    "Dear Valued Customer\n\n"
    "S${amount} has been credited into your PayNow linked A/C ending 8024 "
    "(ref-OTHR-{reference}) on 24 March 2026 at 13:54 (Singapore time).\n\n"
    "Please call +65 6777 0022 immediately if the funds received are from "
    "an unknown person. Do not directly refund any person claiming to have "
    "accidentally transfered fund to you.\n\n"
    "Thank you for banking with Maybank.\n\n\n\n"
    "Maybank Singapore Limited\n\n\n"
    "Please do not reply to this system-generated notification."
)


def _build_order_email(order_number: str, amount: str) -> str:
    return PAYNOW_EMAIL_TEMPLATE.replace(
        "{amount}", amount
    ).replace("{reference}", f"MER-{order_number}")


def _parse_and_call_webhook(test_case, email_body: str):
    """
    Simulate what processPayNowEmails() does: parse the email body,
    extract fields with regex, build a JWT, and POST to the webhook.

    Returns (endpoint, response) tuple.
    """
    amount_match = re.search(AMOUNT_REGEX, email_body)
    test_case.assertIsNotNone(amount_match, "Amount regex did not match email body")
    amount = amount_match.group(1)

    # Try order first (same priority as the Apps Script)
    order_match = re.search(ORDER_REGEX, email_body)
    if order_match:
        order_number = order_match.group(1)
        payload = {"order_number": order_number, "amount": amount}
        token = apps_script_jwt(payload)
        resp = test_case.client.post(
            "/api/verify-payment/",
            data={},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        return "/api/verify-payment/", resp

    # Otherwise try event reference
    reg_match = re.search(EVENT_REG_REF_REGEX, email_body)
    if reg_match:
        ref = reg_match.group(1)
        payload = {"group_reference": ref, "amount": amount}
        token = apps_script_jwt(payload)
        resp = test_case.client.post(
            "/api/verify-event-payment/",
            data={},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        return "/api/verify-event-payment/", resp

    test_case.fail("Neither order nor event regex matched the email body")


# ===================================================================
# Test: Order payment via simulated email
# ===================================================================
class OrderEmailWebhookTest(APITestCase):
    """Place an order, simulate a PayNow email, verify payment confirmed."""

    def _place_order(self):
        client = APIClient()
        auth_client(client)
        create_shipping_method(price=0)
        p = create_product(price=Decimal("40.00"))
        basket_id = client.post("/api/v1/baskets").data["cart_id"]
        client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": p.id, "quantity": 1},
            format="json",
        )
        img = SimpleUploadedFile("proof.jpg", b"fake", content_type="image/jpeg")
        temp_key = client.post(
            "/api/v1/checkout/payment/paynow-proof",
            {"basket_id": basket_id, "payment_proof": img, "donation": 3},
        ).data["temp_key"]
        return client.post(
            "/api/v1/checkout/place-order",
            {"basket_id": basket_id, "temp_key": temp_key},
        ).data

    def test_order_confirmed_via_email_webhook(self):
        order = self._place_order()
        order_number = order["number"]
        amount = str(
            Decimal(str(order["total_incl_tax"]))
            + Decimal(str(order["donation_amount"]))
        )

        email_body = _build_order_email(order_number, amount)
        _, resp = _parse_and_call_webhook(self, email_body)
        self.assertEqual(resp.status_code, 200)

        # Verify DB state
        db_order = Order._default_manager.get(number=order_number)
        self.assertTrue(
            db_order.payment_events.filter(
                event_type__code="paynow-auto-verified"
            ).exists()
        )
        self.assertEqual(
            db_order.status, settings.PAYMENT_AUTO_CONFIRMED_STATUS
        )



# ===================================================================
# Test: JWT edge cases (expired, bad secret, missing fields)
# ===================================================================
class JWTEdgeCasesTest(APITestCase):
    """Verify the webhook rejects malformed / expired / bad-secret JWTs."""

    def test_expired_jwt_rejected(self):
        payload = {
            "order_number": "FAKE",
            "amount": "1.00",
            "exp": int(time.time()) - 10,
        }
        token = apps_script_jwt(payload)
        resp = self.client.post(
            "/api/verify-payment/",
            data={},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(resp.status_code, 401)

    def test_missing_fields_rejected(self):
        # JWT with no order_number or amount
        token = apps_script_jwt({"foo": "bar"})
        resp = self.client.post(
            "/api/verify-payment/",
            data={},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(resp.status_code, 400)
