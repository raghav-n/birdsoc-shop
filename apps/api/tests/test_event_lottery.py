from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

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


class LotteryPromoteTests(APITestCase):
    def _enter(self, event, email, qty=1):
        return self.client.post(
            f"/api/v1/events/{event.id}/register",
            {"first_name": "P", "last_name": "L", "email": email, "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": qty},
            format="json",
        )

    def _draw_event(self, max_participants=1):
        e = create_event(max_participants=max_participants)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        self._enter(e, "winner@x.com")
        self._enter(e, "loser@x.com")
        from apps.event.utils import run_lottery_draw
        run_lottery_draw(e)
        return e

    def _promote_url(self, e, ep):
        return f"/api/v1/console/events/{e.id}/participants/{ep.id}/promote-from-lottery"

    @patch("apps.event.utils.send_lottery_won_email")
    def test_promote_not_selected_confirms_and_emails(self, mock_won):
        e = self._draw_event(max_participants=1)
        # Free up a slot so capacity allows the promotion
        winner = EventParticipant.objects.get(event=e, is_confirmed=True)
        winner.is_confirmed = False
        winner.is_cancelled = True
        winner.save(update_fields=["is_confirmed", "is_cancelled"])

        loser = EventParticipant.objects.get(event=e, is_lottery_lost=True)
        mock_won.reset_mock()  # ignore the won-email sent during the initial draw
        client = staff_client(self.client)
        r = client.post(self._promote_url(e, loser))
        self.assertEqual(r.status_code, 200, r.data)

        loser.refresh_from_db()
        self.assertTrue(loser.is_confirmed)
        self.assertFalse(loser.is_lottery_lost)
        mock_won.assert_called_once()

    @patch("apps.event.utils.send_lottery_won_email")
    def test_promote_rejected_when_no_capacity(self, mock_won):
        e = self._draw_event(max_participants=1)
        loser = EventParticipant.objects.get(event=e, is_lottery_lost=True)
        mock_won.reset_mock()  # ignore the won-email sent during the initial draw
        client = staff_client(self.client)
        r = client.post(self._promote_url(e, loser))
        self.assertEqual(r.status_code, 400)
        loser.refresh_from_db()
        self.assertTrue(loser.is_lottery_lost)
        mock_won.assert_not_called()

    @patch("apps.event.utils.send_lottery_won_email")
    def test_promote_unlimited_capacity_allows(self, mock_won):
        e = self._draw_event(max_participants=None)
        # With unlimited capacity everyone wins, so create a forced not-selected entry
        loser = EventParticipant.objects.filter(event=e, is_confirmed=True).first()
        loser.is_confirmed = False
        loser.is_lottery_lost = True
        loser.save(update_fields=["is_confirmed", "is_lottery_lost"])

        client = staff_client(self.client)
        r = client.post(self._promote_url(e, loser))
        self.assertEqual(r.status_code, 200, r.data)
        loser.refresh_from_db()
        self.assertTrue(loser.is_confirmed)

    def test_promote_rejects_non_lottery_entry(self):
        e = create_event(max_participants=5)
        self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@x.com", "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": 1},
            format="json",
        )
        ep = EventParticipant.objects.get(event=e)
        client = staff_client(self.client)
        r = client.post(self._promote_url(e, ep))
        self.assertEqual(r.status_code, 400)


class LotteryPreviewTests(APITestCase):
    def _enter(self, event, email, qty=1):
        return self.client.post(
            f"/api/v1/events/{event.id}/register",
            {"first_name": "P", "last_name": "L", "email": email, "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": qty},
            format="json",
        )

    def test_preview_returns_winners_and_losers(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com", "d@x.com"]:
            self._enter(e, em)

        client = staff_client(self.client)
        r = client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw")
        self.assertEqual(r.status_code, 200)
        self.assertIn("seed", r.data)
        self.assertEqual(len(r.data["winners"]), 2)
        self.assertEqual(len(r.data["losers"]), 2)
        for w in r.data["winners"]:
            self.assertIn("ep_id", w)
            self.assertIn("first_name", w)
            self.assertIn("email", w)
            self.assertIn("quantity", w)

    def test_preview_does_not_modify_db(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com"]:
            self._enter(e, em)

        client = staff_client(self.client)
        client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw")

        self.assertEqual(EventParticipant.objects.filter(event=e, is_lottery_pending=True).count(), 3)
        self.assertEqual(EventParticipant.objects.filter(event=e, is_confirmed=True).count(), 0)
        e.refresh_from_db()
        self.assertIsNone(e.lottery_drawn_at)

    def test_same_seed_gives_same_result(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com", "d@x.com"]:
            self._enter(e, em)

        client = staff_client(self.client)
        r1 = client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw")
        seed = r1.data["seed"]
        r2 = client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw", {"seed": seed}, format="json")

        self.assertEqual(
            [w["ep_id"] for w in r1.data["winners"]],
            [w["ep_id"] for w in r2.data["winners"]],
        )
        self.assertEqual(
            [l["ep_id"] for l in r1.data["losers"]],
            [l["ep_id"] for l in r2.data["losers"]],
        )

    def test_preview_then_confirm_matches(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com", "d@x.com"]:
            self._enter(e, em)

        client = staff_client(self.client)
        preview = client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw")
        preview_winner_ids = {w["ep_id"] for w in preview.data["winners"]}

        r = client.post(
            f"/api/v1/console/events/{e.id}/run-lottery-draw",
            {"seed": preview.data["seed"]},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        confirmed_ids = set(EventParticipant.objects.filter(event=e, is_confirmed=True).values_list("id", flat=True))
        self.assertEqual(preview_winner_ids, confirmed_ids)

    def test_preview_rejects_already_drawn(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        self._enter(e, "a@x.com")

        client = staff_client(self.client)
        client.post(f"/api/v1/console/events/{e.id}/run-lottery-draw")
        r = client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw")
        self.assertEqual(r.status_code, 400)

    def test_preview_rejects_non_lottery(self):
        e = create_event(max_participants=5)
        client = staff_client(self.client)
        r = client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw")
        self.assertEqual(r.status_code, 400)


class LotteryTestEmailTests(APITestCase):
    def _enter(self, event, email, qty=1):
        return self.client.post(
            f"/api/v1/events/{event.id}/register",
            {"first_name": "P", "last_name": "L", "email": email, "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": qty},
            format="json",
        )

    @patch("apps.event.utils.send_lottery_lost_email")
    @patch("apps.event.utils.send_lottery_won_email")
    def test_sends_two_emails_to_test_address_only(self, mock_won, mock_lost):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com"]:
            self._enter(e, em)

        client = staff_client(self.client)
        r = client.post(
            f"/api/v1/console/events/{e.id}/send-test-lottery-emails",
            {"email": "tester@example.com"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        mock_won.assert_called_once()
        mock_lost.assert_called_once()
        self.assertEqual(mock_won.call_args.kwargs["to_email"], "tester@example.com")
        self.assertEqual(mock_lost.call_args.kwargs["to_email"], "tester@example.com")

        # Draw must not have run.
        e.refresh_from_db()
        self.assertIsNone(e.lottery_drawn_at)
        self.assertEqual(EventParticipant.objects.filter(event=e, is_lottery_pending=True).count(), 3)
        self.assertEqual(EventParticipant.objects.filter(event=e, is_confirmed=True).count(), 0)
        self.assertEqual(EventParticipant.objects.filter(event=e, is_lottery_lost=True).count(), 0)

    @patch("apps.event.utils.send_lottery_lost_email")
    @patch("apps.event.utils.send_lottery_won_email")
    def test_works_with_no_participants(self, mock_won, mock_lost):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()

        client = staff_client(self.client)
        r = client.post(
            f"/api/v1/console/events/{e.id}/send-test-lottery-emails",
            {"email": "tester@example.com"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        mock_won.assert_called_once()
        mock_lost.assert_called_once()

    @patch("apps.event.utils.EmailMultiAlternatives")
    def test_custom_templates_are_rendered(self, MockMsg):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.lottery_won_email_subject = "You won {{event_title}}!"
        e.lottery_won_email_template = "<p>Congrats {{first_name}}, see you at {{event_title}}.</p>"
        e.lottery_lost_email_subject = "Sorry {{first_name}}"
        e.lottery_lost_email_template = "<p>Not this time for {{event_title}}.</p>"
        e.save()

        from apps.event.utils import send_lottery_won_email, send_lottery_lost_email
        Participant = get_model("event", "Participant")
        p = Participant(first_name="Alice", last_name="Last", email="a@x.com", quantity=1)

        send_lottery_won_email(e, p, to_email="tester@example.com")
        self.assertEqual(MockMsg.call_args.kwargs["subject"], f"You won {e.title}!")
        won_html = MockMsg.return_value.attach_alternative.call_args.args[0]
        self.assertIn("Congrats Alice", won_html)
        self.assertIn(e.title, won_html)

        MockMsg.reset_mock()
        send_lottery_lost_email(e, p, to_email="tester@example.com")
        self.assertIn("Sorry Alice", MockMsg.call_args.kwargs["subject"])
        lost_html = MockMsg.return_value.attach_alternative.call_args.args[0]
        self.assertIn(f"Not this time for {e.title}", lost_html)

    def test_requires_email(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        client = staff_client(self.client)
        r = client.post(f"/api/v1/console/events/{e.id}/send-test-lottery-emails", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_rejects_invalid_email(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        client = staff_client(self.client)
        r = client.post(
            f"/api/v1/console/events/{e.id}/send-test-lottery-emails",
            {"email": "not-an-email"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_rejects_non_lottery(self):
        e = create_event(max_participants=5)
        client = staff_client(self.client)
        r = client.post(
            f"/api/v1/console/events/{e.id}/send-test-lottery-emails",
            {"email": "tester@example.com"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)


class LotteryDeprioritizationTests(APITestCase):
    def _enter(self, event, email, qty=1, attended_before=False):
        data = {
            "first_name": "P", "last_name": "L", "email": email,
            "phone_number": "+6512345678",
            "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000",
            "quantity": qty,
        }
        if attended_before:
            data["extra_json"] = {"attended_before": True}
        return self.client.post(
            f"/api/v1/events/{event.id}/register",
            data, format="json",
        )

    def test_newcomers_selected_before_returning(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.collect_prior_attendance = True
        e.save()

        self._enter(e, "returning1@x.com", attended_before=True)
        self._enter(e, "returning2@x.com", attended_before=True)
        self._enter(e, "new1@x.com", attended_before=False)
        self._enter(e, "new2@x.com", attended_before=False)

        from apps.event.utils import compute_lottery_draw
        result = compute_lottery_draw(e, seed=42)

        winner_emails = {w["email"] for w in result["winners"]}
        loser_emails = {l["email"] for l in result["losers"]}
        self.assertEqual(winner_emails, {"new1@x.com", "new2@x.com"})
        self.assertEqual(loser_emails, {"returning1@x.com", "returning2@x.com"})

    def test_no_deprioritization_when_flag_off(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.collect_prior_attendance = False
        e.save()

        self._enter(e, "returning@x.com", attended_before=True)
        self._enter(e, "new@x.com", attended_before=False)

        from apps.event.utils import compute_lottery_draw
        result = compute_lottery_draw(e, seed=42)
        self.assertEqual(len(result["winners"]), 2)

    def test_reserved_member_slots_filled_first(self):
        e = create_event(max_participants=3)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()

        # 2 members, 3 non-members, capacity 3, 2 reserved for members
        for em in ["m1@x.com", "m2@x.com"]:
            self._enter(e, em)
        for em in ["p1@x.com", "p2@x.com", "p3@x.com"]:
            self._enter(e, em)

        # Mark the first two as members
        for ep in EventParticipant.objects.filter(event=e, participant__email__in=["m1@x.com", "m2@x.com"]):
            ep.is_member = True
            ep.save(update_fields=["is_member"])

        from apps.event.utils import compute_lottery_draw
        result = compute_lottery_draw(e, seed=42, reserved_member_slots=2)

        winner_emails = {w["email"] for w in result["winners"]}
        # Both members must win (reserved slots), plus 1 non-member
        self.assertIn("m1@x.com", winner_emails)
        self.assertIn("m2@x.com", winner_emails)
        self.assertEqual(len(result["winners"]), 3)
        self.assertEqual(len(result["losers"]), 2)

    def test_unused_reserved_slots_go_to_public(self):
        e = create_event(max_participants=3)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()

        # 1 member, 3 non-members, capacity 3, 2 reserved for members
        self._enter(e, "m1@x.com")
        for em in ["p1@x.com", "p2@x.com", "p3@x.com"]:
            self._enter(e, em)

        EventParticipant.objects.filter(event=e, participant__email="m1@x.com").update(is_member=True)

        from apps.event.utils import compute_lottery_draw
        result = compute_lottery_draw(e, seed=42, reserved_member_slots=2)

        winner_emails = {w["email"] for w in result["winners"]}
        # Member gets 1 reserved slot, unused reserved slot opens to public
        self.assertIn("m1@x.com", winner_emails)
        self.assertEqual(len(result["winners"]), 3)

    def test_preview_includes_attended_before_flag(self):
        e = create_event(max_participants=5)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.collect_prior_attendance = True
        e.save()

        self._enter(e, "returning@x.com", attended_before=True)
        self._enter(e, "new@x.com", attended_before=False)

        client = staff_client(self.client)
        r = client.post(f"/api/v1/console/events/{e.id}/preview-lottery-draw")
        self.assertEqual(r.status_code, 200)
        by_email = {w["email"]: w for w in r.data["winners"]}
        self.assertTrue(by_email["returning@x.com"]["attended_before"])
        self.assertFalse(by_email["new@x.com"]["attended_before"])


class LotteryResultEmailCommandTests(APITestCase):
    def _enter(self, event, email, qty=1):
        return self.client.post(
            f"/api/v1/events/{event.id}/register",
            {"first_name": "P", "last_name": "L", "email": email, "phone_number": "+6512345678", "emergency_contact_name": "EC", "emergency_contact_phone": "+6500000000", "quantity": qty},
            format="json",
        )

    def _drawn_event(self):
        e = create_event(max_participants=2)
        e.signup_mode = OrganizedEvent.SIGNUP_MODE_LOTTERY
        e.save()
        for em in ["a@x.com", "b@x.com", "c@x.com", "d@x.com"]:
            self._enter(e, em)
        from apps.event.utils import run_lottery_draw
        run_lottery_draw(e)
        return e

    @patch("apps.event.utils.send_lottery_lost_email")
    @patch("apps.event.utils.send_lottery_won_email")
    def test_draw_does_not_send_emails_inline(self, mock_won, mock_lost):
        """The draw must not email in-request — that previously timed out the worker."""
        self._drawn_event()
        mock_won.assert_not_called()
        mock_lost.assert_not_called()
        # Every drawn entry is queued (sent_at NULL) for the background command.
        self.assertEqual(
            EventParticipant.objects.filter(
                is_lottery_pending=False, lottery_result_email_sent_at__isnull=True
            ).count(),
            4,
        )

    @patch("apps.event.utils.send_lottery_lost_email", return_value=True)
    @patch("apps.event.utils.send_lottery_won_email", return_value=True)
    def test_command_sends_and_is_idempotent(self, mock_won, mock_lost):
        from django.core.management import call_command
        e = self._drawn_event()

        call_command("send_lottery_result_emails")
        self.assertEqual(mock_won.call_count, 2)
        self.assertEqual(mock_lost.call_count, 2)
        self.assertEqual(
            EventParticipant.objects.filter(
                event=e, lottery_result_email_sent_at__isnull=True
            ).count(),
            0,
        )

        # Re-running sends nothing more.
        mock_won.reset_mock()
        mock_lost.reset_mock()
        call_command("send_lottery_result_emails")
        mock_won.assert_not_called()
        mock_lost.assert_not_called()

    @patch("apps.event.utils.send_lottery_lost_email", return_value=False)
    @patch("apps.event.utils.send_lottery_won_email", return_value=False)
    def test_failed_send_is_retried(self, mock_won, mock_lost):
        from django.core.management import call_command
        e = self._drawn_event()

        call_command("send_lottery_result_emails")
        # Nothing stamped, so all remain queued for the next run.
        self.assertEqual(
            EventParticipant.objects.filter(
                event=e, lottery_result_email_sent_at__isnull=True, is_lottery_pending=False
            ).count(),
            4,
        )


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
