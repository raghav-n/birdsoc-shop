from __future__ import annotations

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase

from apps.api.tests.utils import create_product, create_shipping_method, create_user


class AnalyticsDashboardTests(APITestCase):
    def test_dashboard_includes_donation_totals_separately(self):
        create_shipping_method(price=0, is_self_collect=True)
        product = create_product(price=25)

        basket_id = self.client.post("/api/v1/baskets").data["cart_id"]
        self.client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": product.id, "quantity": 1},
            format="json",
        )
        img = SimpleUploadedFile("proof.jpg", b"image-bytes", content_type="image/jpeg")
        placed = self.client.post(
            "/api/v1/checkout/place-order",
            {"basket_id": basket_id, "payment_proof": img, "donation": 5},
        )
        self.assertEqual(placed.status_code, 201, placed.data)

        admin = create_user(email="admin@example.com")
        admin.is_staff = True
        admin.is_superuser = True
        admin.save(update_fields=["is_staff", "is_superuser"])

        staff_client = APIClient()
        staff_client.force_authenticate(user=admin)
        response = staff_client.get("/api/v1/analytics/dashboard")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["total_revenue"], "25.00")
        self.assertEqual(response.data["summary"]["total_donations"], "5.00")
        self.assertEqual(response.data["summary"]["total_collected"], "30.00")
        self.assertEqual(len(response.data["by_month"]), 1)
        self.assertEqual(response.data["by_month"][0]["revenue"], "25.00")
        self.assertEqual(response.data["by_month"][0]["donations"], "5.00")
        self.assertEqual(response.data["by_month"][0]["collected"], "30.00")
