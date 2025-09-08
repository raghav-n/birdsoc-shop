from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient

from apps.api.tests.utils import auth_client


class RefundsExtraTests(APITestCase):
    def test_detail_not_found_and_staff_access(self):
        # Not found
        c = APIClient()
        auth_client(c)
        r = c.get("/api/v1/refunds/999999")
        self.assertEqual(r.status_code, 404)

        # Create a refund
        payload = {
            "name": "Buyer",
            "email": "buyer2@example.com",
            "paynow_phone": "12345678",
            "order_number": "9999",
            "amount": "10.00",
            "reason": "Test",
        }
        rid = self.client.post("/api/v1/refunds", payload, format="json").data["id"]

        # Staff user can access
        User = get_user_model()
        staff = User.objects.create_user(
            username="staff@example.com",
            email="staff@example.com",
            password="Passw0rd!",
            is_staff=True,
        )
        c = APIClient()
        auth_client(c, email=staff.email)
        r = c.get(f"/api/v1/refunds/{rid}")
        self.assertEqual(r.status_code, 200)
