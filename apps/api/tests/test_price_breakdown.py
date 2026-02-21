from __future__ import annotations

from decimal import Decimal
from rest_framework.test import APITestCase

from apps.api.tests.utils import create_event


class PriceBreakdownTests(APITestCase):
    """Tests for POST /api/v1/events/<pk>/price-breakdown"""

    def _paid_event(self, price="8.00", **kwargs):
        e = create_event(**kwargs)
        e.price_incl_tax = Decimal(price)
        e.save()
        return e

    def test_basic_breakdown(self):
        e = self._paid_event()
        payload = {
            "participants": [
                {"quantity": 2},
                {"quantity": 1},
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/price-breakdown", payload, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["event"], e.id)
        self.assertEqual(r.data["totals"]["quantity"], 3)
        self.assertEqual(r.data["totals"]["amount"], "24.00")  # 8*3
        self.assertFalse(r.data.get("requires_payment") is None)

    def test_breakdown_with_donation(self):
        e = self._paid_event(price="5.00")
        payload = {
            "participants": [{"quantity": 1}],
            "donation": 3,
        }
        r = self.client.post(f"/api/v1/events/{e.id}/price-breakdown", payload, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["totals"]["donation"], "3")
        self.assertEqual(r.data["totals"]["amount_with_donation"], "8.00")

    def test_breakdown_capacity_info(self):
        e = self._paid_event(max_participants=5)
        payload = {"participants": [{"quantity": 3}]}
        r = self.client.post(f"/api/v1/events/{e.id}/price-breakdown", payload, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("capacity", r.data)
        self.assertTrue(r.data["capacity"]["available"])
        self.assertEqual(r.data["capacity"]["remaining"], 5)

    def test_breakdown_capacity_exceeded(self):
        e = self._paid_event(max_participants=2)
        payload = {"participants": [{"quantity": 3}]}
        r = self.client.post(f"/api/v1/events/{e.id}/price-breakdown", payload, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["capacity"]["available"])

    def test_breakdown_event_not_found(self):
        r = self.client.post(
            "/api/v1/events/999999/price-breakdown",
            {"participants": [{"quantity": 1}]},
            format="json",
        )
        self.assertEqual(r.status_code, 404)

    def test_breakdown_missing_participants(self):
        e = self._paid_event()
        r = self.client.post(f"/api/v1/events/{e.id}/price-breakdown", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_breakdown_empty_list(self):
        e = self._paid_event()
        r = self.client.post(
            f"/api/v1/events/{e.id}/price-breakdown", {"participants": []}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_breakdown_invalid_quantity(self):
        e = self._paid_event()
        r = self.client.post(
            f"/api/v1/events/{e.id}/price-breakdown",
            {"participants": [{"quantity": 0}]},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_free_event_not_requires_payment(self):
        e = create_event()
        e.price_incl_tax = Decimal("0.00")
        e.save()
        payload = {"participants": [{"quantity": 1}]}
        r = self.client.post(f"/api/v1/events/{e.id}/price-breakdown", payload, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["requires_payment"])

    def test_breakdown_with_price_tiers(self):
        e = create_event()
        e.price_incl_tax = Decimal("20.00")
        e.price_tiers = [
            {"code": "student", "name": "Student", "rule": "age:<19", "price_incl_tax": 10.0},
            {"code": "adult", "name": "Adult", "rule": "*", "price_incl_tax": 20.0},
        ]
        e.save()

        payload = {
            "participants": [
                {"quantity": 1, "extra_json": {"age": 15}},  # student tier
                {"quantity": 1, "extra_json": {"age": 25}},  # adult tier
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/price-breakdown", payload, format="json")
        self.assertEqual(r.status_code, 200)
        items = r.data["items"]
        self.assertEqual(items[0]["unit_price"], "10.0")
        self.assertEqual(items[1]["unit_price"], "20.0")
        self.assertEqual(r.data["totals"]["amount"], "30.0")
