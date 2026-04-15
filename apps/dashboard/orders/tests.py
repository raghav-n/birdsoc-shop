from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.api.tests.utils import auth_client, create_product, create_shipping_method, create_user


class OrderScanDashboardTests(TestCase):
    def _place_order(self):
        api_client = APIClient()
        auth_client(api_client, email="buyer@example.com")

        product = create_product(title="Scan Test Badge", price=12)
        shipping_method = create_shipping_method(price=0)

        basket_id = api_client.post("/api/v1/baskets").data["cart_id"]
        api_client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": product.id, "quantity": 2},
            format="json",
        )
        image = SimpleUploadedFile("proof.jpg", b"fake-bytes", content_type="image/jpeg")
        temp_key = api_client.post(
            "/api/v1/checkout/payment/paynow-proof",
            {"basket_id": basket_id, "payment_proof": image},
        ).data["temp_key"]

        response = api_client.post(
            "/api/v1/checkout/place-order",
            {
                "basket_id": basket_id,
                "temp_key": temp_key,
                "shipping_method_code": shipping_method.code,
            },
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_staff_can_open_scan_result_with_valid_id(self):
        order = self._place_order()
        staff_user = create_user(email="staff@example.com")
        staff_user.is_staff = True
        staff_user.save(update_fields=["is_staff"])
        self.client.force_login(staff_user)

        response = self.client.get(
            reverse("dashboard:order-scan-result", kwargs={"number": order["number"]}),
            {"id": order["access_id"]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, order["number"])
        self.assertContains(response, "Test User")
        self.assertContains(response, "Scan Test Badge")
        self.assertContains(response, '<td class="text-right">2</td>', html=True)

    def test_scan_result_requires_valid_id(self):
        order = self._place_order()
        staff_user = create_user(email="staff@example.com")
        staff_user.is_staff = True
        staff_user.save(update_fields=["is_staff"])
        self.client.force_login(staff_user)

        response = self.client.get(
            reverse("dashboard:order-scan-result", kwargs={"number": order["number"]}),
            {"id": "invalid"},
        )

        self.assertEqual(response.status_code, 404)
