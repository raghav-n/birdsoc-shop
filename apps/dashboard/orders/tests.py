from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from oscar.core.loading import get_model
from rest_framework.test import APIClient

from apps.api.tests.utils import auth_client, create_product, create_shipping_method, create_user
from apps.order.cash_remittance import amount_in_words, build_context
from apps.order.models import SalesPeriod


Order = get_model("order", "Order")


class OrderLookupApiTests(TestCase):
    def _place_order(self, email="buyer@example.com", product_title="Scan Test Badge"):
        api_client = APIClient()
        auth_client(api_client, email=email)

        product = create_product(title=product_title, price=12)
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

    def _staff_client(self):
        staff = create_user(email="staff@example.com")
        staff.is_staff = True
        staff.is_superuser = True
        staff.save(update_fields=["is_staff", "is_superuser"])
        client = APIClient()
        auth_client(client, email="staff@example.com")
        return client

    def test_staff_can_look_up_order_with_valid_access_id(self):
        order = self._place_order()
        client = self._staff_client()

        response = client.get(
            "/api/v1/orders/search",
            {"number": order["number"], "id": order["access_id"]},
        )

        self.assertEqual(response.status_code, 200)
        orders = response.data["orders"]
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["number"], order["number"])
        self.assertEqual(orders[0]["items"][0]["title"], "Scan Test Badge")
        self.assertEqual(orders[0]["items"][0]["quantity"], 2)

    def test_lookup_returns_all_orders_for_the_same_person(self):
        first = self._place_order(product_title="First Badge")
        second = self._place_order(product_title="Second Badge")
        client = self._staff_client()

        response = client.get(
            "/api/v1/orders/search",
            {"number": first["number"], "id": first["access_id"]},
        )

        self.assertEqual(response.status_code, 200)
        numbers = {o["number"] for o in response.data["orders"]}
        self.assertEqual(numbers, {first["number"], second["number"]})

    def test_number_search_returns_all_orders_for_the_same_person(self):
        first = self._place_order(product_title="First Badge")
        second = self._place_order(product_title="Second Badge")
        client = self._staff_client()

        response = client.get(
            "/api/v1/orders/search", {"number": first["number"]}
        )

        self.assertEqual(response.status_code, 200)
        numbers = {o["number"] for o in response.data["orders"]}
        self.assertEqual(numbers, {first["number"], second["number"]})

    def test_collected_orders_sort_after_active_orders(self):
        active = self._place_order(product_title="Active Badge")
        collected = self._place_order(product_title="Collected Badge")
        collected_order = Order.objects.get(number=collected["number"])
        collected_order.status = settings.COLLECTED_STATUS
        collected_order.save(update_fields=["status"])
        client = self._staff_client()

        response = client.get(
            "/api/v1/orders/search",
            {"number": active["number"], "id": active["access_id"]},
        )

        self.assertEqual(response.status_code, 200)
        orders = response.data["orders"]
        self.assertEqual(orders[0]["number"], active["number"])
        self.assertEqual(orders[-1]["number"], collected["number"])

    def test_lookup_rejects_invalid_access_id(self):
        order = self._place_order()
        client = self._staff_client()

        response = client.get(
            "/api/v1/orders/search",
            {"number": order["number"], "id": "invalid"},
        )

        self.assertEqual(response.status_code, 403)


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

        # NoAdminMiddleware hides the whole dashboard from non-superusers.
        self.assertEqual(response.status_code, 404)
        self.assertNotContains(response, 'value="delete_order"', status_code=404)

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

        # NoAdminMiddleware rejects non-superusers before the view runs.
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())


class CashRemittanceTests(TestCase):
    def setUp(self):
        create_shipping_method(code="ONSITE", price=0, is_self_collect=True)
        self.admin = create_user(email="cash-admin@example.com", first_name="Treasurer", last_name="Tan")
        self.admin.is_staff = True
        self.admin.is_superuser = True
        self.admin.save(update_fields=["is_staff", "is_superuser"])
        self.staff_api = APIClient()
        self.staff_api.force_authenticate(user=self.admin)
        now = timezone.now()
        self.period = SalesPeriod.objects.create(
            name="AOC 2026", start=now - timedelta(hours=1), end=now + timedelta(hours=1)
        )

    def _cash_sale(self, product, quantity):
        prepare = self.staff_api.post(
            "/api/v1/onsite/pending",
            {"products": [{"id": product.id, "quantity": quantity}]},
            format="json",
        )
        self.assertEqual(prepare.status_code, 201, prepare.data)
        number = prepare.data["order_number"]
        confirm = self.staff_api.post(
            "/api/v1/onsite/confirm-cash", {"order_number": number}, format="json"
        )
        self.assertEqual(confirm.status_code, 200, confirm.data)
        return Order.objects.get(number=number)

    def test_lists_only_cash_sales_with_totals(self):
        tee = create_product(title="Onsite Tee", price=25)
        badge = create_product(title="Badge", price=4)
        first = self._cash_sale(tee, 1)
        second = self._cash_sale(badge, 3)
        # A PayNow order in the same period is not cash and must not appear.
        OrderDeleteDashboardTests._place_order(self)

        context = build_context(self.period, prepared_by="Treasurer Tan")

        rows = [row for day in context["days"] for row in day["rows"]]
        self.assertEqual(
            [row["reference"] for row in rows],
            [f"{settings.ORDER_PREFIX}{first.number}", f"{settings.ORDER_PREFIX}{second.number}"],
        )
        self.assertEqual(rows[1]["items"], [{"title": "Badge", "quantity": 3}])
        self.assertEqual(context["totals"]["count"], 2)
        self.assertEqual(context["totals"]["cash"], Decimal("37.00"))
        self.assertEqual(context["net_cash"], Decimal("37.00"))
        self.assertEqual(context["net_cash_words"], "Thirty-seven Singapore dollars only")

    def test_dashboard_button_downloads_pdf(self):
        self._cash_sale(create_product(title="Onsite Tee", price=25), 1)
        self.client.force_login(self.admin)
        url = reverse("dashboard:sales-report-cash-remittance", kwargs={"pk": self.period.pk})

        page = self.client.get(reverse("dashboard:sales-report"))
        self.assertContains(page, url)

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("cash-remittance-aoc-2026.pdf", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_amount_in_words(self):
        self.assertEqual(
            amount_in_words(Decimal("1242.50")),
            "One thousand two hundred and forty-two Singapore dollars and fifty cents",
        )
        self.assertEqual(amount_in_words(Decimal("1.01")), "One Singapore dollar and one cent")
        self.assertEqual(amount_in_words(Decimal("2005")), "Two thousand and five Singapore dollars only")
        self.assertEqual(amount_in_words(Decimal("0")), "Zero Singapore dollars only")
