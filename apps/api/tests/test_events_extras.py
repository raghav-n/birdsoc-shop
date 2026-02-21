from __future__ import annotations

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
