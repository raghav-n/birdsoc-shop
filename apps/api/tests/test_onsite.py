from __future__ import annotations

from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from oscar.core.loading import get_model
from rest_framework.test import APIClient, APITestCase

from apps.api.tests.utils import create_product, create_shipping_method, create_user
from apps.checkout.models import PendingCheckout

Order = get_model("order", "Order")


class OnsitePendingTests(APITestCase):
    @patch("apps.api.views.payments.find_paynow_email_for_order")
    @patch("apps.api.views.payments.build_gmail_service")
    def test_pending_payment_flow_creates_order_only_after_confirmation(
        self, mock_build_gmail_service, mock_find_paynow_email_for_order
    ):
        create_shipping_method(code="ONSITE", price=0, is_self_collect=True)
        product = create_product(title="Onsite Tee", price=25)

        admin = create_user(email="onsite-admin@example.com")
        admin.is_staff = True
        admin.is_superuser = True
        admin.save(update_fields=["is_staff", "is_superuser"])

        staff_client = APIClient()
        staff_client.force_authenticate(user=admin)

        prepare = staff_client.post(
            "/api/v1/onsite/pending",
            {"products": [{"id": product.id, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(prepare.status_code, 201, prepare.data)
        order_number = prepare.data["order_number"]
        reference = prepare.data["reference"]

        self.assertTrue(order_number.startswith("2"))
        self.assertEqual(reference, f"{settings.ORDER_PREFIX}{order_number}")
        self.assertFalse(Order._default_manager.filter(number=order_number).exists())

        pending = PendingCheckout.objects.get(reference=reference)
        self.assertEqual(pending.basket_snapshot["order_number"], order_number)
        self.assertEqual(pending.shipping_method_code, "ONSITE")

        mock_build_gmail_service.return_value = object()
        mock_find_paynow_email_for_order.return_value = {
            "amount": "25.00",
            "received_at": timezone.now(),
            "from_email": "alerts@example.com",
        }

        response = self.client.get(
            "/api/v1/checkout/payment/paynow-email-check",
            {"order": order_number},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["confirmed"])

        order = Order._default_manager.get(number=order_number)
        self.assertEqual(order.status, settings.PAYMENT_AUTO_CONFIRMED_STATUS)
        self.assertEqual(order.total_incl_tax_with_donation, 25)
        self.assertTrue(
            order.payment_events.filter(event_type__code="paynow-auto-verified").exists()
        )
        self.assertFalse(
            PendingCheckout.objects.filter(reference=reference).exists()
        )
