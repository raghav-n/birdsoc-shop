from __future__ import annotations

from decimal import Decimal

from rest_framework.test import APITestCase

from apps.api.tests.utils import create_event


class EventsExtraTests(APITestCase):
    def test_list_and_retrieve(self):
        e = create_event()
        r = self.client.get("/api/v1/events")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(i["id"] == e.id for i in r.data))
        r = self.client.get(f"/api/v1/events/{e.id}")
        self.assertEqual(r.status_code, 200)

    def test_register_validation_and_capacity(self):
        e = create_event(max_participants=1)
        # Invalid email
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "bad", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

        # Zero qty
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 0},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

        # Fill capacity
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "cap@a.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)

        # Next registration should fail due to capacity
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "C", "last_name": "D", "email": "full@a.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_register_event_not_found(self):
        r = self.client.post(
            "/api/v1/events/999999/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 404)

    def test_retrieve_not_found(self):
        r = self.client.get("/api/v1/events/999999")
        self.assertEqual(r.status_code, 404)

    def test_list_excludes_inactive(self):
        active = create_event(is_active=True)
        inactive = create_event(is_active=False)
        r = self.client.get("/api/v1/events")
        self.assertEqual(r.status_code, 200)
        ids = [e["id"] for e in r.data]
        self.assertIn(active.id, ids)
        self.assertNotIn(inactive.id, ids)


class EventRegistrationStatusTests(APITestCase):
    def setUp(self):
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(False)

    def tearDown(self):
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(False)

    def test_registration_status_endpoint_open(self):
        r = self.client.get("/api/v1/events/registration-status")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["global_registration_closed"])

    def test_registration_status_endpoint_closed(self):
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(True)
        r = self.client.get("/api/v1/events/registration-status")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["global_registration_closed"])

    def test_register_blocked_when_global_closed(self):
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(True)
        e = create_event()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data.get("code"), "registration_closed")
        self.assertTrue(r.data.get("global_registration_closed"))

    def test_bulk_register_blocked_when_global_closed(self):
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(True)
        e = create_event()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register/bulk",
            {"participants": [{"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1}]},
            format="json",
        )
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data.get("code"), "registration_closed")


class EventMaxQtyTests(APITestCase):
    def test_register_exceeds_max_qty(self):
        e = create_event()
        e.max_qty = 2
        e.save()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 3},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("2", r.data["detail"])

    def test_register_at_max_qty_allowed(self):
        e = create_event()
        e.max_qty = 3
        e.save()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 3},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)

    def test_register_with_donation_adds_to_total(self):
        e = create_event()
        e.price_incl_tax = Decimal("0.00")
        e.save()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1, "donation": 5},
            format="json",
        )
        # Donation makes it paid so registration should be created
        self.assertEqual(r.status_code, 201, r.data)
        self.assertFalse(r.data.get("confirmed"))
        self.assertEqual(r.data["registration"]["donation_amount"], "5")

    def test_register_negative_donation_rejected(self):
        e = create_event()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1, "donation": -1},
            format="json",
        )
        self.assertEqual(r.status_code, 400)


class WaitlistTests(APITestCase):
    def test_partial_capacity_exceeded_routes_to_waitlist(self):
        """Requesting more spots than remain on a free event routes to waitlist when enabled."""
        from unittest import mock
        e = create_event(max_participants=2)
        e.waitlist_enabled = True
        e.save()
        # Fill 1 spot
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        # Request 2 spots (only 1 remains) — goes to waitlist
        with mock.patch("apps.event.utils.send_waitlist_joined_email"):
            r = self.client.post(
                f"/api/v1/events/{e.id}/register",
                {"first_name": "C", "last_name": "D", "email": "c@d.com", "quantity": 2},
                format="json",
            )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data.get("waitlisted"))
        self.assertEqual(r.data.get("waitlist_position"), 1)

    def test_full_event_without_waitlist_rejected(self):
        """Full free event without waitlist enabled rejects additional registrations."""
        e = create_event(max_participants=1)
        self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            format="json",
        )
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "C", "last_name": "D", "email": "c@d.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("waitlisted", r.data)

    def test_paid_event_full_rejects_even_with_waitlist_enabled(self):
        """Paid event at capacity rejects registration even when waitlist is enabled."""
        e = create_event(max_participants=1)
        e.waitlist_enabled = True
        e.price_incl_tax = Decimal("10.00")
        e.save()
        # First registration occupies the pending slot
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        # Second registration is rejected, not waitlisted
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "C", "last_name": "D", "email": "c@d.com", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("waitlisted", r.data)
