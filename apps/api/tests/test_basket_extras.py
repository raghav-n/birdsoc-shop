from __future__ import annotations

from rest_framework.test import APITestCase, APIClient
from oscar.core.loading import get_model

from apps.api.tests.utils import create_product, auth_client


Basket = get_model("basket", "Basket")


class BasketExtraTests(APITestCase):
    def test_current_basket_resolution_and_not_found(self):
        # Guest basket
        guest_id = self.client.post("/api/v1/baskets").data["cart_id"]

        # Not found
        r = self.client.get("/api/v1/baskets/current", {"cart_id": 999999})
        self.assertEqual(r.status_code, 404)

        # Found via query
        r = self.client.get("/api/v1/baskets/current", {"cart_id": guest_id})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], guest_id)

        # Header also works
        r = self.client.get("/api/v1/baskets/current", HTTP_X_CART_ID=str(guest_id))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], guest_id)

        # Authenticated user basket takes precedence
        client = APIClient()
        auth_client(client)
        user_basket_id = client.post("/api/v1/baskets").data["cart_id"]
        r = client.get(
            "/api/v1/baskets/current",
            HTTP_X_CART_ID=str(guest_id),
            QUERY_STRING=f"cart_id={guest_id}",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], user_basket_id)

    def test_add_invalid_product_and_line_permission(self):
        # Create basket as user A
        p = create_product(price=12)
        client_a = APIClient()
        auth_client(client_a, email="usera@example.com")
        basket_id = client_a.post("/api/v1/baskets").data["cart_id"]

        # Invalid product
        r = self.client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": 999999, "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 404)

        # User B forbidden to edit A's basket
        # Add a valid line under A
        client_a.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": p.id, "quantity": 1},
            format="json",
        )
        line_id = Basket._default_manager.get(id=basket_id).lines.first().id

        client_b = APIClient()
        auth_client(client_b, email="userb@example.com")
        r = client_b.patch(
            f"/api/v1/baskets/{basket_id}/lines/{line_id}",
            {"quantity": 2},
            format="json",
        )
        self.assertEqual(r.status_code, 403)

    def test_line_update_quantity_validation(self):
        p = create_product(price=5)
        basket_id = self.client.post("/api/v1/baskets").data["cart_id"]
        resp = self.client.post(
            f"/api/v1/baskets/{basket_id}/lines",
            {"product_id": p.id, "quantity": 1},
            format="json",
        )
        line_id = resp.data["lines"][0]["id"]

        # Non-integer quantity
        r = self.client.patch(
            f"/api/v1/baskets/{basket_id}/lines/{line_id}",
            {"quantity": "x"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
