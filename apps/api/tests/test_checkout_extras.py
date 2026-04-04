from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from oscar.core.loading import get_model
from rest_framework.test import APITestCase

from apps.api.tests.utils import create_product, create_shipping_method

PendingCheckout = get_model("checkout", "PendingCheckout")
Order = get_model("order", "Order")


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

    @patch("apps.api.views.payments.find_paynow_email_for_order")
    @patch("apps.api.views.payments.build_gmail_service")
    def test_paynow_email_check_places_pending_checkout_and_confirms_payment(
        self, mock_build_gmail_service, mock_find_paynow_email_for_order
    ):
        method = create_shipping_method(price=0, is_self_collect=True)
        basket_id = self._basket_with_line(price=25)
        order_number = str(settings.BASE_ORDER_NUMBER + int(basket_id))
        PendingCheckout.objects.create(
            basket_id=basket_id,
            email="guest@example.com",
            reference=f"{settings.ORDER_PREFIX}{order_number}",
            shipping_method_code=method.code,
            donation=5,
            basket_snapshot={},
        )

        mock_build_gmail_service.return_value = object()
        mock_find_paynow_email_for_order.return_value = (
            "30.00",
            timezone.now(),
        )

        response = self.client.get(
            "/api/v1/checkout/payment/paynow-email-check",
            {"order": order_number},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["confirmed"])
        self.assertTrue(response.data["found"])

        order = Order._default_manager.get(number=order_number)
        self.assertEqual(order.status, settings.PAYMENT_AUTO_CONFIRMED_STATUS)
        self.assertEqual(order.total_incl_tax_with_donation, Decimal("30.00"))
        self.assertTrue(
            order.payment_events.filter(event_type__code="paynow-auto-verified").exists()
        )
        self.assertFalse(
            PendingCheckout.objects.filter(
                reference=f"{settings.ORDER_PREFIX}{order_number}"
            ).exists()
        )

    @patch("apps.api.views.payments.send_mail")
    @patch("apps.api.views.payments.build_gmail_service")
    def test_localhost_paynow_test_email_uses_pending_checkout_total(
        self, mock_build_gmail_service, mock_send_mail
    ):
        method = create_shipping_method(price=0, is_self_collect=True)
        basket_id = self._basket_with_line(price=25)
        order_number = str(settings.BASE_ORDER_NUMBER + int(basket_id))
        PendingCheckout.objects.create(
            basket_id=basket_id,
            email="guest@example.com",
            reference=f"{settings.ORDER_PREFIX}{order_number}",
            shipping_method_code=method.code,
            donation=5,
            basket_snapshot={"total": "25.00"},
        )

        response = self.client.post(
            "/api/v1/checkout/payment/paynow-email-test",
            {"order": order_number},
            format="json",
            HTTP_HOST="localhost:8000",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["sent"])
        self.assertEqual(response.data["amount"], "30.00")
        self.assertEqual(mock_send_mail.call_count, 1)

        _, kwargs = mock_send_mail.call_args
        self.assertEqual(
            kwargs["subject"],
            "PayNow Alert - You have received a payment via PayNow",
        )
        self.assertIn("ref-OTHR-MER-", kwargs["message"])
        self.assertIn(order_number, kwargs["message"])
        self.assertIn("S$30.00", kwargs["message"])

    @patch("apps.api.views.payments.send_mail")
    def test_paynow_test_email_is_not_available_off_localhost(self, mock_send_mail):
        response = self.client.post(
            "/api/v1/checkout/payment/paynow-email-test",
            {"order": "100001"},
            format="json",
        )

        self.assertEqual(response.status_code, 403, response.data)
        mock_send_mail.assert_not_called()
