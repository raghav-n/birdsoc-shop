from __future__ import annotations

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient

from apps.api.tests.utils import auth_client, create_product, create_shipping_method


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
