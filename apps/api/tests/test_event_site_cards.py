from __future__ import annotations

from django.core.management import call_command
from django.utils import timezone
from oscar.core.loading import get_model
from rest_framework.test import APITestCase

OrganizedEvent = get_model("event", "OrganizedEvent")


def _make_site_event(order, name, *, is_active, tag="obd-2026"):
    return OrganizedEvent._default_manager.create(
        title=f"October Big Day 2026: {name}",
        description="<p>Long shop description.</p>",
        start_date=timezone.now() + timezone.timedelta(days=30),
        location=f"{name} · via Fort Canning Centre",
        is_active=is_active,
        tags=[tag],
        metadata={
            "site_card": {
                "order": order,
                "name": name,
                "region": "Central",
                "ebird_url": f"https://ebird.org/hotspot/L{order}",
                "start": f"{name} carpark",
                "end": None if order % 2 else f"{name} exit",
                "description": f"Short card copy for {name}.",
            }
        },
    )


class SiteCardsEndpointTests(APITestCase):
    def test_site_cards_include_drafts_and_are_ordered(self):
        _make_site_event(2, "Bishan-AMK Park", is_active=False)
        _make_site_event(1, "Bidadari Park", is_active=False)

        r = self.client.get("/api/v1/events/site-cards?tag=obd-2026")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([c["order"] for c in r.data], [1, 2])
        first = r.data[0]
        self.assertEqual(first["name"], "Bidadari Park")
        self.assertEqual(first["ebird_url"], "https://ebird.org/hotspot/L1")
        self.assertEqual(first["description"], "Short card copy for Bidadari Park.")
        # Presentation-only: no booking/capacity fields leak through
        for leaked in ("participant_count", "max_participants", "price_incl_tax",
                       "registration_open", "json_schema"):
            self.assertNotIn(leaked, first)

    def test_drafts_stay_hidden_from_the_normal_events_list(self):
        _make_site_event(1, "Bidadari Park", is_active=False)
        r = self.client.get("/api/v1/events")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(any("October Big Day 2026" in i["title"] for i in r.data))

    def test_default_tag_and_tag_filtering(self):
        _make_site_event(1, "Bidadari Park", is_active=True)
        # An event without the tag is excluded
        OrganizedEvent._default_manager.create(
            title="Unrelated walk",
            start_date=timezone.now() + timezone.timedelta(days=5),
            is_active=True,
            tags=["other"],
            metadata={"site_card": {"order": 9, "name": "Nope"}},
        )
        r = self.client.get("/api/v1/events/site-cards")  # defaults to obd-2026
        self.assertEqual(r.status_code, 200)
        self.assertEqual([c["name"] for c in r.data], ["Bidadari Park"])

        r2 = self.client.get("/api/v1/events/site-cards?tag=missing")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data, [])


class SetupCommandSiteCardsTests(APITestCase):
    def test_setup_command_populates_six_ordered_cards_as_drafts(self):
        call_command("setup_obd_2026")

        # Six draft events created, hidden from the public list…
        tagged = sum(
            1 for e in OrganizedEvent._default_manager.all()
            if "obd-2026" in (e.tags or [])
        )
        self.assertEqual(tagged, 6)
        r = self.client.get("/api/v1/events")
        self.assertFalse(any("October Big Day 2026" in i["title"] for i in r.data))

        # …but all six surface through site-cards, ordered 1..6 with card fields.
        r = self.client.get("/api/v1/events/site-cards")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([c["order"] for c in r.data], [1, 2, 3, 4, 5, 6])
        first = r.data[0]
        self.assertEqual(first["name"], "Bidadari Park")
        self.assertEqual(first["ebird_url"], "https://ebird.org/hotspot/L38405173")
        self.assertTrue(first["description"].startswith("Singapore's best-known"))
        self.assertFalse(first["is_active"])
        # A combined "Start & end" site carries end=None
        thomson = next(c for c in r.data if c["name"] == "Thomson Nature Park")
        self.assertIsNone(thomson["end"])

    def test_setup_command_is_idempotent(self):
        call_command("setup_obd_2026")
        call_command("setup_obd_2026")
        cards = self.client.get("/api/v1/events/site-cards").data
        self.assertEqual(len(cards), 6)
