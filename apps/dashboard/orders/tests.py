from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from oscar.core.loading import get_model
from rest_framework.test import APIClient

from apps.api.tests.utils import auth_client, create_product, create_shipping_method, create_user


Order = get_model("order", "Order")


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
        self.assertEqual(response.context["items"][0]["title"], "Scan Test Badge")
        self.assertEqual(response.context["items"][0]["quantity"], 2)

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


class OrderDeleteDashboardTests(TestCase):
    def _place_order(self):
        api_client = APIClient()
        auth_client(api_client, email="buyer@example.com")

        product = create_product(title="Delete Test Badge", price=12)
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
        return Order.objects.get(number=response.data["number"])

    def test_superuser_sees_delete_button_for_uncollected_order(self):
        order = self._place_order()
        superuser = create_user(email="admin@example.com")
        superuser.is_staff = True
        superuser.is_superuser = True
        superuser.save(update_fields=["is_staff", "is_superuser"])
        self.client.force_login(superuser)

        response = self.client.get(
            reverse("dashboard:order-detail", kwargs={"number": order.number})
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'value="delete_order"')

    def test_staff_non_superuser_does_not_see_delete_button(self):
        order = self._place_order()
        staff_user = create_user(email="staff@example.com")
        staff_user.is_staff = True
        staff_user.save(update_fields=["is_staff"])
        self.client.force_login(staff_user)

        response = self.client.get(
            reverse("dashboard:order-detail", kwargs={"number": order.number})
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'value="delete_order"')

    def test_collected_order_does_not_show_delete_button(self):
        order = self._place_order()
        order.status = settings.COLLECTED_STATUS
        order.save(update_fields=["status"])
        superuser = create_user(email="admin@example.com")
        superuser.is_staff = True
        superuser.is_superuser = True
        superuser.save(update_fields=["is_staff", "is_superuser"])
        self.client.force_login(superuser)

        response = self.client.get(
            reverse("dashboard:order-detail", kwargs={"number": order.number})
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'value="delete_order"')

    def test_superuser_can_delete_order_and_release_allocations(self):
        order = self._place_order()
        line = order.lines.select_related("stockrecord").get()
        stockrecord = line.stockrecord
        superuser = create_user(email="admin@example.com")
        superuser.is_staff = True
        superuser.is_superuser = True
        superuser.save(update_fields=["is_staff", "is_superuser"])
        self.client.force_login(superuser)

        response = self.client.post(
            reverse("dashboard:order-detail", kwargs={"number": order.number}),
            {"order_action": "delete_order"},
        )

        self.assertRedirects(response, reverse("dashboard:order-list"))
        self.assertFalse(Order.objects.filter(pk=order.pk).exists())
        stockrecord.refresh_from_db()
        self.assertEqual(stockrecord.num_allocated, 0)

    def test_non_superuser_cannot_delete_order(self):
        order = self._place_order()
        staff_user = create_user(email="staff@example.com")
        staff_user.is_staff = True
        staff_user.save(update_fields=["is_staff"])
        self.client.force_login(staff_user)

        response = self.client.post(
            reverse("dashboard:order-detail", kwargs={"number": order.number}),
            {"order_action": "delete_order"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())
