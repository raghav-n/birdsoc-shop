from __future__ import annotations

from decimal import Decimal

from rest_framework.test import APITestCase
from oscar.core.loading import get_model

from apps.api.tests.utils import create_event, create_user, auth_client


OrganizedEvent = get_model("event", "OrganizedEvent")
EventParticipant = get_model("event", "EventParticipant")


def staff_client(client):
    from django.contrib.auth.models import Group

    grp, _ = Group.objects.get_or_create(name="Events")
    user = create_user(email="staff@example.com", password="Passw0rd!")
    user.groups.add(grp)
    user.save()
    return auth_client(client, email="staff@example.com", password="Passw0rd!")


class LotterySignupTests(APITestCase):
    def test_lottery_entries_collected_without_capacity_check(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()

        # Three entries, capacity is 2 — all should be accepted as lottery_pending
        for i, email in enumerate(["a@x.com", "b@x.com", "c@x.com"]):
            r = self.client.post(
                f"/api/v1/events/{e.id}/register",
                {"first_name": f"P{i}", "last_name": "L", "email": email, "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": 1},
                format="json",
            )
            self.assertEqual(r.status_code, 201, r.data)
            self.assertTrue(r.data["lottery_pending"])
            self.assertFalse(r.data["confirmed"])

        self.assertEqual(EventParticipant.objects.filter(event=e, is_lottery_pending=True).count(), 3)

    def test_lottery_rejects_paid_events(self):
        e = create_event(max_participants=5)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.price_incl_tax = Decimal("10.00")
        e.save()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "z@x.com", "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("free", r.data["detail"].lower())

    def test_lottery_blocks_after_drawn(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        from apps.event.utils import run_lottery_draw
        run_lottery_draw(e)
        e.refresh_from_db()
        self.assertIsNotNone(e.lottery_drawn_at)

        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "late@x.com", "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": 1},
            format="json",
        )
        self.assertEqual(r.status_code, 403)

    def test_lottery_bulk_register_blocked(self):
        e = create_event(max_participants=5)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register/bulk",
            {
                "participants": [
                    {"first_name": "A", "last_name": "B", "email": "a@x.com"},
                ]
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)


class LotteryDrawTests(APITestCase):
    def _enter(self, event, email, qty=1):
        return self.client.post(
            f"/api/v1/events/{event.id}/register",
            {"first_name": "P", "last_name": "L", "email": email, "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": qty},
            format="json",
        )

    def test_draw_selects_within_capacity_and_marks_losers(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com", "d@x.com"]:
            self._enter(e, em)

        from apps.event.utils import run_lottery_draw
        result = run_lottery_draw(e)

        self.assertEqual(result["winners"], 2)
        self.assertEqual(result["losers"], 2)
        winners = EventParticipant.objects.filter(event=e, is_confirmed=True, is_cancelled=False)
        losers = EventParticipant.objects.filter(event=e, is_lottery_lost=True)
        self.assertEqual(winners.count(), 2)
        self.assertEqual(losers.count(), 2)
        e.refresh_from_db()
        self.assertIsNotNone(e.lottery_drawn_at)

    def test_draw_unlimited_capacity_picks_everyone(self):
        e = create_event(max_participants=None)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com"]:
            self._enter(e, em)
        from apps.event.utils import run_lottery_draw
        result = run_lottery_draw(e)
        self.assertEqual(result["winners"], 3)
        self.assertEqual(result["losers"], 0)

    def test_console_run_draw_endpoint(self):
        e = create_event(max_participants=1)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        self._enter(e, "a@x.com")
        self._enter(e, "b@x.com")

        client = staff_client(self.client)
        r = client.post(f"/api/v1/console/events/{e.id}/run-lottery-draw")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["winners"], 1)
        self.assertEqual(r.data["losers"], 1)
        self.assertIsNotNone(r.data["lottery_drawn_at"])

        # Second call should be rejected as already drawn
        r2 = client.post(f"/api/v1/console/events/{e.id}/run-lottery-draw")
        self.assertEqual(r2.status_code, 400)

    def test_console_run_draw_rejects_non_lottery(self):
        e = create_event(max_participants=5)
        client = staff_client(self.client)
        r = client.post(f"/api/v1/console/events/{e.id}/run-lottery-draw")
        self.assertEqual(r.status_code, 400)


class LotteryConsoleCreateTests(APITestCase):
    def test_console_rejects_lottery_with_price(self):
        from django.utils import timezone
        client = staff_client(self.client)
        r = client.post(
            "/api/v1/console/events",
            {
                "title": "Paid Lottery",
                "start_date": (timezone.now() + timezone.timedelta(days=1)).isoformat(),
                "signup_mode": "lottery",
                "price_incl_tax": "10.00",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("free", r.data["detail"].lower())

    def test_console_accepts_lottery_free(self):
        from django.utils import timezone
        client = staff_client(self.client)
        r = client.post(
            "/api/v1/console/events",
            {
                "title": "Free Lottery",
                "start_date": (timezone.now() + timezone.timedelta(days=1)).isoformat(),
                "signup_mode": "lottery",
                "price_incl_tax": "0",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["signup_mode"], "lottery")
        self.assertTrue(r.data["is_lottery"])
