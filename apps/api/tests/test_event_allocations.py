from __future__ import annotations

from decimal import Decimal

from rest_framework.test import APITestCase
from oscar.core.loading import get_model

from apps.api.tests.utils import create_event


OrganizedEvent = get_model("event", "OrganizedEvent")
EventGroup = get_model("event", "EventGroup")
EventAllocation = get_model("event", "EventAllocation")
EventRegistration = get_model("event", "EventRegistration")


class EventAllocationTests(APITestCase):
    ACCESS = "NPARKS-OBD26-ABC123"

    def setUp(self):
        self.group = EventGroup.objects.create(
            name="October Big Day 2026", slug="october-big-day-2026"
        )
        # Two events in the group share one 2-slot reserved pool.
        self.event_a = create_event(title="OBD Site A")
        self.event_b = create_event(title="OBD Site B")
        for e in (self.event_a, self.event_b):
            e.group = self.group
            e.price_incl_tax = Decimal("28.00")
            e.max_qty = 5
            e.save()
        self.alloc = EventAllocation.objects.create(
            group=self.group,
            code="nparks",
            name="NParks Volunteer",
            total_slots=2,
            price_incl_tax=Decimal("5.00"),
            max_qty_per_registration=1,
            access_code=self.ACCESS,
        )

    def _register(self, event, email, access_code=None, quantity=1):
        payload = {
            "first_name": "Vol",
            "last_name": "Unteer",
            "email": email,
            "quantity": quantity,
        }
        if access_code is not None:
            payload["access_code"] = access_code
        return self.client.post(
            f"/api/v1/events/{event.id}/register", payload, format="json"
        )

    def test_valid_code_charges_allocation_price(self):
        r = self._register(self.event_a, "a@x.com", self.ACCESS)
        self.assertEqual(r.status_code, 201, r.data)
        reg = EventRegistration.objects.get(id=r.data["registration"]["id"])
        self.assertEqual(reg.amount, Decimal("5.00"))
        self.assertEqual(reg.allocation_id, self.alloc.id)
        self.assertEqual(reg.status, "pending")

    def test_code_is_case_insensitive(self):
        r = self._register(self.event_a, "a@x.com", self.ACCESS.lower())
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["registration"]["amount"], "5.00")

    def test_no_code_uses_event_price(self):
        r = self._register(self.event_a, "a@x.com")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["registration"]["amount"], "28.00")

    def test_wrong_code_uses_event_price(self):
        r = self._register(self.event_a, "a@x.com", "NOPE")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["registration"]["amount"], "28.00")

    def test_quantity_capped_by_allocation(self):
        r = self._register(self.event_a, "a@x.com", self.ACCESS, quantity=2)
        self.assertEqual(r.status_code, 400)
        self.assertIn("per registration", r.data["detail"])

    def test_pool_is_shared_across_events_and_exhausts(self):
        # 2 slots: one at each site, then the third (either site) is rejected.
        self.assertEqual(self._register(self.event_a, "a@x.com", self.ACCESS).status_code, 201)
        self.assertEqual(self._register(self.event_b, "b@x.com", self.ACCESS).status_code, 201)
        self.assertEqual(self.alloc.remaining, 0)
        r = self._register(self.event_a, "c@x.com", self.ACCESS)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data.get("code"), "allocation_full")

    def test_cancelled_registration_frees_a_slot(self):
        self._register(self.event_a, "a@x.com", self.ACCESS)
        reg = EventRegistration.objects.get(participant__email="a@x.com")
        self.assertEqual(self.alloc.remaining, 1)
        reg.status = "cancelled"
        reg.save()
        self.assertEqual(self.alloc.remaining, 2)

    def test_price_breakdown_reflects_allocation(self):
        r = self.client.post(
            f"/api/v1/events/{self.event_a.id}/price-breakdown",
            {"participants": [{"quantity": 1}], "access_code": self.ACCESS},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["items"][0]["unit_price"], "5.00")
        self.assertIn("allocation", r.data)
        self.assertEqual(r.data["allocation"]["remaining"], 2)
        self.assertEqual(r.data["allocation"]["name"], "NParks Volunteer")

    def _fill_public(self, event, n, prefix):
        for i in range(n):
            r = self._register(event, f"{prefix}{i}@x.com")
            self.assertEqual(r.status_code, 201, r.data)

    def test_public_hold_blocks_even_when_site_has_room(self):
        # Two sites cap 5 each (total 10); reserved pool 2 -> public ceiling 8.
        for e in (self.event_a, self.event_b):
            e.max_participants = 5
            e.save()
        self._fill_public(self.event_a, 4, "pa")
        self._fill_public(self.event_b, 4, "pb")  # 8 public total

        # Site A still has a physical seat (4/5), but the group-wide hold on the
        # 2 unclaimed reserved slots blocks a 9th public registration.
        r = self._register(self.event_a, "extra@x.com")
        self.assertEqual(r.status_code, 400)
        self.assertIn("spots remaining", r.data["detail"])

        # A volunteer may still claim a reserved slot at that same site.
        r = self._register(self.event_a, "vol@x.com", self.ACCESS)
        self.assertEqual(r.status_code, 201, r.data)

    def test_hold_is_dynamic_and_shown_in_preview(self):
        for e in (self.event_a, self.event_b):
            e.max_participants = 5
            e.save()
        self._fill_public(self.event_a, 4, "pa")
        self._fill_public(self.event_b, 4, "pb")  # public ceiling reached

        # Public preview: group hold binds -> 0 remaining, unavailable.
        pub = self.client.post(
            f"/api/v1/events/{self.event_a.id}/price-breakdown",
            {"participants": [{"quantity": 1}]},
            format="json",
        )
        self.assertEqual(pub.data["capacity"]["remaining"], 0)
        self.assertFalse(pub.data["capacity"]["available"])

        # Volunteer preview: sees the plain per-site seat (1 left), not the hold.
        vol = self.client.post(
            f"/api/v1/events/{self.event_a.id}/price-breakdown",
            {"participants": [{"quantity": 1}], "access_code": self.ACCESS},
            format="json",
        )
        self.assertEqual(vol.data["capacity"]["remaining"], 1)
        self.assertTrue(vol.data["capacity"]["available"])

    def test_allocation_block_reports_public_availability(self):
        for e in (self.event_a, self.event_b):
            e.max_participants = 5
            e.save()

        # Plenty of public room -> fallback offer is available.
        r = self.client.post(
            f"/api/v1/events/{self.event_a.id}/price-breakdown",
            {"participants": [{"quantity": 1}], "access_code": self.ACCESS},
            format="json",
        )
        self.assertTrue(r.data["allocation"]["public_available"])

        # Fill the public ceiling (10 caps - 2 reserved = 8 public).
        self._fill_public(self.event_a, 4, "pa")
        self._fill_public(self.event_b, 4, "pb")
        r = self.client.post(
            f"/api/v1/events/{self.event_a.id}/price-breakdown",
            {"participants": [{"quantity": 1}], "access_code": self.ACCESS},
            format="json",
        )
        self.assertFalse(r.data["allocation"]["public_available"])

    def test_allocation_only_applies_within_its_group(self):
        # An event with no group ignores the code entirely.
        loner = create_event(title="Standalone")
        loner.price_incl_tax = Decimal("28.00")
        loner.save()
        r = self._register(loner, "a@x.com", self.ACCESS)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["registration"]["amount"], "28.00")
