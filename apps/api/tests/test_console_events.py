from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from oscar.core.loading import get_model
from rest_framework.test import APITestCase

from apps.api.tests.utils import auth_client, create_event, create_user


OrganizedEvent = get_model("event", "OrganizedEvent")
EventParticipant = get_model("event", "EventParticipant")
Participant = get_model("event", "Participant")
EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")


def _events_staff_client(client):
    """Authenticate as an Events-group member and return the same client."""
    group, _ = Group.objects.get_or_create(name="Events")
    user = create_user(email="events_staff@example.com")
    user.groups.add(group)
    auth_client(client, email="events_staff@example.com")
    return client


def _future_date(days=7):
    return (timezone.now() + timezone.timedelta(days=days)).isoformat()


class ConsoleEventsAuthTests(APITestCase):
    def test_anonymous_blocked(self):
        r = self.client.get("/api/v1/console/events")
        self.assertIn(r.status_code, (401, 403))

    def test_non_events_group_blocked(self):
        create_user(email="plain@example.com")
        auth_client(self.client, email="plain@example.com")
        r = self.client.get("/api/v1/console/events")
        self.assertEqual(r.status_code, 403)

    def test_events_staff_allowed(self):
        _events_staff_client(self.client)
        r = self.client.get("/api/v1/console/events")
        self.assertEqual(r.status_code, 200)

    def test_superuser_allowed(self):
        User = get_user_model()
        su = User.objects.create_superuser(
            username="superuser@example.com",
            email="superuser@example.com",
            password="Passw0rd!",
        )
        resp = self.client.post(
            "/api/v1/auth/token/",
            {"email": "superuser@example.com", "password": "Passw0rd!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        r = self.client.get("/api/v1/console/events")
        self.assertEqual(r.status_code, 200)


class ConsoleEventsListTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)

    def test_list_includes_inactive_and_past_events(self):
        active = create_event(is_active=True)
        inactive = create_event(is_active=False)
        r = self.client.get("/api/v1/console/events")
        self.assertEqual(r.status_code, 200)
        ids = [e["id"] for e in r.data]
        self.assertIn(active.id, ids)
        self.assertIn(inactive.id, ids)

    def test_list_q_filter(self):
        e1 = create_event(title="BirdWatching Walk")
        e2 = create_event(title="Photography Basics")
        r = self.client.get("/api/v1/console/events", {"q": "BirdWatching"})
        self.assertEqual(r.status_code, 200)
        ids = [e["id"] for e in r.data]
        self.assertIn(e1.id, ids)
        self.assertNotIn(e2.id, ids)

    def test_list_event_shape(self):
        e = create_event()
        r = self.client.get("/api/v1/console/events")
        self.assertEqual(r.status_code, 200)
        event_data = next(d for d in r.data if d["id"] == e.id)
        for key in ("id", "title", "is_active", "stats", "price_incl_tax"):
            self.assertIn(key, event_data)


class ConsoleEventsRetrieveTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)

    def test_retrieve_includes_participants_registrations_groups(self):
        e = create_event()
        r = self.client.get(f"/api/v1/console/events/{e.id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], e.id)
        self.assertIn("bookings", r.data)
        self.assertIn("stats", r.data)

    def test_retrieve_lists_free_participants(self):
        e = create_event()
        e.price_incl_tax = Decimal("0.00")
        e.save()
        self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "Jo", "last_name": "B", "email": "jo@test.com", "quantity": 1},
            format="json",
        )
        r = self.client.get(f"/api/v1/console/events/{e.id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["bookings"]), 1)
        self.assertEqual(r.data["bookings"][0]["email"], "jo@test.com")

    def test_retrieve_not_found(self):
        r = self.client.get("/api/v1/console/events/999999")
        self.assertEqual(r.status_code, 404)


class ConsoleEventsCreateTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)

    def test_create_success(self):
        r = self.client.post(
            "/api/v1/console/events",
            {"title": "New Event", "start_date": _future_date(), "price_incl_tax": "10.00"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["title"], "New Event")
        self.assertEqual(r.data["price_incl_tax"], "10.00")

    def test_create_defaults_is_active_true(self):
        r = self.client.post(
            "/api/v1/console/events",
            {"title": "Default Active", "start_date": _future_date()},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["is_active"])

    def test_create_missing_title_fails(self):
        r = self.client.post(
            "/api/v1/console/events",
            {"start_date": _future_date()},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_create_missing_start_date_fails(self):
        r = self.client.post(
            "/api/v1/console/events",
            {"title": "No Date"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_create_invalid_image_id_fails(self):
        r = self.client.post(
            "/api/v1/console/events",
            {"title": "Bad Image", "start_date": _future_date(), "image_id": 999999},
            format="json",
        )
        self.assertEqual(r.status_code, 400)


class ConsoleEventsUpdateTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)
        self.event = create_event(title="Original Title")

    def test_partial_update_title_and_location(self):
        r = self.client.patch(
            f"/api/v1/console/events/{self.event.id}",
            {"title": "Updated Title", "location": "Botanic Gardens"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["title"], "Updated Title")
        self.assertEqual(r.data["location"], "Botanic Gardens")

    def test_partial_update_deactivate(self):
        r = self.client.patch(
            f"/api/v1/console/events/{self.event.id}",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["is_active"])

    def test_partial_update_not_found(self):
        r = self.client.patch(
            "/api/v1/console/events/999999", {"title": "X"}, format="json"
        )
        self.assertEqual(r.status_code, 404)


class ConsoleEventsDeleteTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)

    def test_destroy_deletes_event(self):
        e = create_event()
        r = self.client.delete(f"/api/v1/console/events/{e.id}")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(OrganizedEvent.objects.filter(id=e.id).exists())

    def test_destroy_not_found(self):
        r = self.client.delete("/api/v1/console/events/999999")
        self.assertEqual(r.status_code, 404)


class ConsoleParticipantTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)
        self.event = create_event()
        self.event.price_incl_tax = Decimal("0.00")
        self.event.save()
        # Use public endpoint to register a free participant
        self.client.post(
            f"/api/v1/events/{self.event.id}/register",
            {"first_name": "A", "last_name": "B", "email": "ab@test.com", "quantity": 1},
            format="json",
        )
        self.ep_id = EventParticipant.objects.filter(event=self.event).first().id

    def test_toggle_attendance_on(self):
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/participants/{self.ep_id}/toggle-attendance"
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["attended"])

    def test_toggle_attendance_off(self):
        # Toggle on then off
        self.client.post(
            f"/api/v1/console/events/{self.event.id}/participants/{self.ep_id}/toggle-attendance"
        )
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/participants/{self.ep_id}/toggle-attendance"
        )
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["attended"])

    def test_toggle_attendance_not_found(self):
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/participants/999999/toggle-attendance"
        )
        self.assertEqual(r.status_code, 404)

    def test_update_participant_notes(self):
        r = self.client.patch(
            f"/api/v1/console/events/{self.event.id}/participants/{self.ep_id}",
            {"notes": "VIP member"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["notes"], "VIP member")

    def test_update_participant_cancel(self):
        r = self.client.patch(
            f"/api/v1/console/events/{self.event.id}/participants/{self.ep_id}",
            {"is_cancelled": True},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["is_cancelled"])

    def test_update_participant_not_found(self):
        r = self.client.patch(
            f"/api/v1/console/events/{self.event.id}/participants/999999",
            {"notes": "x"},
            format="json",
        )
        self.assertEqual(r.status_code, 404)


class ConsoleVerifyRegistrationTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)
        self.event = create_event()
        self.event.price_incl_tax = Decimal("5.00")
        self.event.save()

    def _create_registration(self):
        r = self.client.post(
            f"/api/v1/events/{self.event.id}/register",
            {"first_name": "P", "last_name": "Q", "email": "pq@test.com", "quantity": 1},
            format="json",
        )
        return r.data["registration"]["id"]

    def test_verify_success(self):
        reg_id = self._create_registration()
        r = self.client.post(f"/api/v1/console/event-registrations/{reg_id}/verify")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["payment_verified"])
        self.assertEqual(r.data["status"], "paid")

    def test_verify_updates_participant_confirmed(self):
        reg_id = self._create_registration()
        self.client.post(f"/api/v1/console/event-registrations/{reg_id}/verify")
        reg = EventRegistration.objects.get(id=reg_id)
        ep = EventParticipant.objects.get(event=self.event, participant=reg.participant)
        self.assertTrue(ep.is_confirmed)

    def test_verify_not_found(self):
        r = self.client.post("/api/v1/console/event-registrations/999999/verify")
        self.assertEqual(r.status_code, 404)

    def test_verify_already_verified_returns_400(self):
        reg_id = self._create_registration()
        self.client.post(f"/api/v1/console/event-registrations/{reg_id}/verify")
        r = self.client.post(f"/api/v1/console/event-registrations/{reg_id}/verify")
        self.assertEqual(r.status_code, 400)

    def test_verify_blocked_for_anonymous(self):
        reg_id = self._create_registration()
        from rest_framework.test import APIClient
        anon = APIClient()
        r = anon.post(f"/api/v1/console/event-registrations/{reg_id}/verify")
        self.assertIn(r.status_code, (401, 403))


class ConsoleVerifyGroupTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)
        self.event = create_event()
        self.event.price_incl_tax = Decimal("5.00")
        self.event.save()

    def _create_group(self):
        r = self.client.post(
            f"/api/v1/events/{self.event.id}/register/bulk",
            {
                "participants": [
                    {"first_name": "G", "last_name": "R", "email": "gr@test.com", "quantity": 1},
                ]
            },
            format="json",
        )
        return r.data["group"]["id"]

    def test_verify_group_success(self):
        group_id = self._create_group()
        r = self.client.post(f"/api/v1/console/event-registration-groups/{group_id}/verify")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["payment_verified"])
        self.assertEqual(r.data["status"], "paid")

    def test_verify_group_not_found(self):
        r = self.client.post("/api/v1/console/event-registration-groups/999999/verify")
        self.assertEqual(r.status_code, 404)

    def test_verify_group_already_verified_returns_400(self):
        group_id = self._create_group()
        self.client.post(f"/api/v1/console/event-registration-groups/{group_id}/verify")
        r = self.client.post(f"/api/v1/console/event-registration-groups/{group_id}/verify")
        self.assertEqual(r.status_code, 400)


class ConsoleRegistrationToggleTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(False)

    def tearDown(self):
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(False)

    def test_get_status_returns_open(self):
        r = self.client.get("/api/v1/console/registration-toggle")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["registration_closed"])

    def test_close_registration(self):
        r = self.client.post(
            "/api/v1/console/registration-toggle",
            {"registration_closed": True},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["registration_closed"])
        # Verify persisted
        r2 = self.client.get("/api/v1/console/registration-toggle")
        self.assertTrue(r2.data["registration_closed"])

    def test_reopen_registration(self):
        from apps.event.utils import set_global_registration_closed
        set_global_registration_closed(True)
        r = self.client.post(
            "/api/v1/console/registration-toggle",
            {"registration_closed": False},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["registration_closed"])

    def test_blocked_for_anonymous(self):
        from rest_framework.test import APIClient
        anon = APIClient()
        r = anon.get("/api/v1/console/registration-toggle")
        self.assertIn(r.status_code, (401, 403))


class EventImageTests(APITestCase):
    def setUp(self):
        _events_staff_client(self.client)

    def test_list_images_empty(self):
        r = self.client.get("/api/v1/console/event-images")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.data, list)

    def test_upload_image_success(self):
        img = SimpleUploadedFile("bird.jpg", b"fake-image-data", content_type="image/jpeg")
        r = self.client.post(
            "/api/v1/console/event-images",
            {"file": img},
            format="multipart",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("id", r.data)
        self.assertIn("url", r.data)
        self.assertIn("uploaded_at", r.data)

    def test_upload_image_missing_file(self):
        r = self.client.post("/api/v1/console/event-images", {}, format="multipart")
        self.assertEqual(r.status_code, 400)

    def test_uploaded_image_appears_in_list(self):
        img = SimpleUploadedFile("bird2.jpg", b"fake-image-data-2", content_type="image/jpeg")
        upload_r = self.client.post(
            "/api/v1/console/event-images",
            {"file": img},
            format="multipart",
        )
        image_id = upload_r.data["id"]
        r = self.client.get("/api/v1/console/event-images")
        self.assertTrue(any(i["id"] == image_id for i in r.data))

    def test_blocked_for_anonymous(self):
        from rest_framework.test import APIClient
        anon = APIClient()
        r = anon.get("/api/v1/console/event-images")
        self.assertIn(r.status_code, (401, 403))


class FollowupEmailTests(APITestCase):
    """Tests for the standalone "send follow-up email" endpoint."""

    def setUp(self):
        _events_staff_client(self.client)
        self.event = create_event(title="Sentosa Walk", max_participants=50)

    def _add_participant(self, email, *, is_confirmed=True, is_cancelled=False, is_waitlisted=False):
        Participant = get_model("event", "Participant")
        p = Participant._default_manager.create(
            first_name="A", last_name="B", email=email, quantity=1,
        )
        return EventParticipant.objects.create(
            event=self.event, participant=p,
            is_confirmed=is_confirmed, is_cancelled=is_cancelled, is_waitlisted=is_waitlisted,
        )

    @patch("apps.event.utils.send_followup_email")
    def test_sends_only_to_confirmed_participants(self, mock_send):
        self._add_participant("confirmed1@example.com")
        self._add_participant("confirmed2@example.com")
        self._add_participant("cancelled@example.com", is_confirmed=False, is_cancelled=True)
        self._add_participant("waitlisted@example.com", is_confirmed=False, is_waitlisted=True)

        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/send-followup-email",
            {"subject": "Hi {{first_name}}", "body": "<p>See you at {{event_title}}</p>"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["sent"], 2)
        self.assertEqual(mock_send.call_count, 2)
        emailed = {c.args[1].email for c in mock_send.call_args_list}
        self.assertEqual(emailed, {"confirmed1@example.com", "confirmed2@example.com"})

    @patch("apps.event.utils.send_followup_email")
    def test_dedupes_by_email(self, mock_send):
        self._add_participant("dup@example.com")
        self._add_participant("dup@example.com")
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/send-followup-email",
            {"subject": "S", "body": "<p>B</p>"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["sent"], 1)

    @patch("apps.event.utils.send_followup_email")
    def test_test_email_sends_single_to_address_only(self, mock_send):
        self._add_participant("confirmed@example.com")
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/send-followup-email",
            {"subject": "S", "body": "<p>B</p>", "test_email": "tester@example.com"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        mock_send.assert_called_once()
        self.assertEqual(mock_send.call_args.kwargs["to_email"], "tester@example.com")

    @patch("apps.event.utils.send_followup_email")
    def test_requires_subject_and_body(self, mock_send):
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/send-followup-email",
            {"subject": "", "body": "<p>B</p>"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/send-followup-email",
            {"subject": "S", "body": ""},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        mock_send.assert_not_called()

    @patch("apps.event.utils.send_followup_email")
    def test_invalid_test_email_rejected(self, mock_send):
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/send-followup-email",
            {"subject": "S", "body": "<p>B</p>", "test_email": "not-an-email"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        mock_send.assert_not_called()

    @patch("apps.event.utils.send_followup_email")
    def test_no_confirmed_participants_returns_400(self, mock_send):
        r = self.client.post(
            f"/api/v1/console/events/{self.event.id}/send-followup-email",
            {"subject": "S", "body": "<p>B</p>"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        mock_send.assert_not_called()


class ConsoleEventGroupTests(APITestCase):
    def setUp(self):
        EventGroup = get_model("event", "EventGroup")
        EventAllocation = get_model("event", "EventAllocation")
        self.group = EventGroup.objects.create(name="Big Day", slug="big-day")
        self.event_a = create_event(title="Site A")
        self.event_b = create_event(title="Site B")
        self.ungrouped = create_event(title="Solo walk")
        for e in (self.event_a, self.event_b):
            e.group = self.group
            e.save()
        self.alloc = EventAllocation.objects.create(
            group=self.group, code="vol", name="Volunteer", total_slots=3, price_incl_tax=Decimal("5.00"),
            access_code="CODE",
        )
        for event, email, code in ((self.event_a, "a@x.com", "CODE"), (self.event_b, "b@x.com", None)):
            payload = {"first_name": "F", "last_name": "L", "email": email, "quantity": 1}
            if code:
                payload["access_code"] = code
            r = self.client.post(f"/api/v1/events/{event.id}/register", payload, format="json")
            self.assertEqual(r.status_code, 201, r.data)

    def test_anonymous_blocked(self):
        r = self.client.get(f"/api/v1/console/event-groups/{self.group.id}")
        self.assertIn(r.status_code, (401, 403))

    def test_event_list_includes_group(self):
        _events_staff_client(self.client)
        r = self.client.get("/api/v1/console/events")
        by_id = {e["id"]: e for e in r.data}
        self.assertEqual(by_id[self.event_a.id]["group"]["id"], self.group.id)
        self.assertIsNone(by_id[self.ungrouped.id]["group"])

    def test_group_list(self):
        _events_staff_client(self.client)
        r = self.client.get("/api/v1/console/event-groups")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual([e["title"] for e in r.data[0]["events"]], ["Site A", "Site B"])
        self.assertNotIn("bookings", r.data[0]["events"][0])

    def test_group_detail_has_bookings_without_payment(self):
        _events_staff_client(self.client)
        r = self.client.get(f"/api/v1/console/event-groups/{self.group.id}")
        self.assertEqual(r.status_code, 200)
        events = {e["title"]: e for e in r.data["events"]}
        a_booking = events["Site A"]["bookings"][0]
        self.assertEqual(a_booking["email"], "a@x.com")
        self.assertEqual(a_booking["allocation"], "Volunteer")
        self.assertNotIn("payment", a_booking)
        self.assertIsNone(events["Site B"]["bookings"][0]["allocation"])
        self.assertEqual(r.data["allocations"][0]["remaining"], 2)

    def test_group_detail_404(self):
        _events_staff_client(self.client)
        r = self.client.get("/api/v1/console/event-groups/9999")
        self.assertEqual(r.status_code, 404)

    # ── quick-edit fields, add participant, guide link ──────────────────────

    def _set_quick_edit(self, keys):
        return self.client.patch(
            f"/api/v1/console/event-groups/{self.group.id}", {"quick_edit_fields": keys}, format="json"
        )

    def test_driving_is_always_a_field_option(self):
        _events_staff_client(self.client)
        r = self.client.get(f"/api/v1/console/event-groups/{self.group.id}")
        driving = next(o for o in r.data["field_options"] if o["key"] == "driving")
        self.assertEqual(driving["enum"], ["Yes", "No", "Unsure"])
        self.assertEqual(r.data["quick_edit_fields"], [])
        self.assertEqual(r.data["guide_token"], str(self.group.guide_token))

    def test_set_quick_edit_fields(self):
        _events_staff_client(self.client)
        r = self._set_quick_edit(["driving", "driving"])
        self.assertEqual(r.status_code, 200, r.data)
        self.group.refresh_from_db()
        self.assertEqual(self.group.quick_edit_fields, ["driving"])
        self.assertEqual(self._set_quick_edit(["nope"]).status_code, 400)

    def test_add_participant_with_name_and_phone_only(self):
        _events_staff_client(self.client)
        self._set_quick_edit(["driving"])
        r = self.client.post(
            f"/api/v1/console/event-groups/{self.group.id}/participants",
            {"event_id": self.event_b.id, "name": "Tan Ah Kow", "phone_number": "91234567", "extra": {"driving": "Yes"}},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        b = next(
            b for e in r.data["events"] if e["id"] == self.event_b.id
            for b in e["bookings"] if b["phone_number"] == "91234567"
        )
        self.assertEqual((b["first_name"], b["last_name"], b["email"]), ("Tan", "Ah Kow", ""))
        self.assertTrue(b["is_confirmed"])
        self.assertEqual(b["extra_json"][0]["driving"], "Yes")

    def test_add_participant_validation(self):
        _events_staff_client(self.client)
        url = f"/api/v1/console/event-groups/{self.group.id}/participants"
        base = {"event_id": self.event_a.id, "name": "X", "phone_number": "9"}
        self.assertEqual(self.client.post(url, {**base, "name": ""}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {**base, "phone_number": ""}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {**base, "event_id": self.ungrouped.id}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {**base, "email": "bad"}, format="json").status_code, 400)

    def test_set_extra_field(self):
        _events_staff_client(self.client)
        self._set_quick_edit(["driving"])
        ep = EventParticipant.objects.get(event=self.event_a)
        url = f"/api/v1/console/event-groups/{self.group.id}/participants/{ep.id}/extra"
        r = self.client.patch(url, {"slot": 0, "key": "driving", "value": "No"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        ep.refresh_from_db()
        self.assertEqual(ep.extra_json[0]["driving"], "No")
        self.assertEqual(self.client.patch(url, {"slot": 0, "key": "driving", "value": "Maybe"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(url, {"slot": 1, "key": "driving", "value": "No"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(url, {"slot": 0, "key": "attended_before", "value": True}, format="json").status_code, 400)
        self.client.patch(url, {"slot": 0, "key": "driving", "value": None}, format="json")
        ep.refresh_from_db()
        self.assertNotIn("driving", ep.extra_json[0])

    def test_guide_link(self):
        self._set_quick_edit_direct(["driving"])
        token = self.group.guide_token
        r = self.client.get(f"/api/v1/guide/group/{token}")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("guide_token", r.data)
        self.assertNotIn("payment", r.data["events"][0]["bookings"][0])

        ep = EventParticipant.objects.get(event=self.event_a)
        url = f"/api/v1/guide/group/{token}/participants/{ep.id}"
        self.assertTrue(self.client.post(url).data["attended"])
        self.client.patch(url, {"notes": "late"}, format="json")
        self.client.patch(url, {"slot": 0, "key": "driving", "value": "Unsure"}, format="json")
        ep.refresh_from_db()
        self.assertEqual(ep.notes, "late")
        self.assertEqual(ep.extra_json[0]["driving"], "Unsure")

        r = self.client.post(
            f"/api/v1/guide/group/{token}/participants",
            {"event_id": self.event_a.id, "name": "Walk In", "phone_number": "8"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)

    def test_guide_link_scoped_to_group(self):
        other = create_event(title="Other")
        p = Participant.objects.create(first_name="O", last_name="P", email="o@x.com")
        ep = EventParticipant.objects.create(event=other, participant=p, is_confirmed=True)
        url = f"/api/v1/guide/group/{self.group.guide_token}/participants/{ep.id}"
        self.assertEqual(self.client.post(url).status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/guide/group/{uuid.uuid4()}").status_code, 404)

    def test_regenerate_group_guide_token(self):
        _events_staff_client(self.client)
        old = self.group.guide_token
        r = self.client.post(f"/api/v1/console/event-groups/{self.group.id}/regenerate-guide-token")
        self.assertEqual(r.status_code, 200)
        self.assertNotEqual(r.data["guide_token"], str(old))
        self.client.logout()
        self.assertEqual(self.client.get(f"/api/v1/guide/group/{old}").status_code, 404)

    def _set_quick_edit_direct(self, keys):
        self.group.quick_edit_fields = keys
        self.group.save()

    # ── checkpoints ─────────────────────────────────────────────────────────

    def test_checkpoints_per_person(self):
        _events_staff_client(self.client)
        ep = EventParticipant.objects.select_related("participant").get(event=self.event_a)
        ep.participant.quantity = 2
        ep.participant.save()
        url = f"/api/v1/console/event-groups/{self.group.id}/participants/{ep.id}/checkpoint"

        r = self.client.post(url, {"slot": 1, "checkpoint": 1}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["attended"])
        self.assertNotIn("1", r.data["checkpoints"][0])
        self.assertIn("1", r.data["checkpoints"][1])

        r = self.client.post(url, {"slot": 0, "checkpoint": 2}, format="json")
        self.assertIn("2", r.data["checkpoints"][0])

        r = self.client.post(url, {"slot": 1, "checkpoint": 1}, format="json")
        self.assertFalse(r.data["attended"])
        self.assertEqual(self.client.post(url, {"slot": 2, "checkpoint": 1}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"slot": 0, "checkpoint": 3}, format="json").status_code, 400)

    def test_legacy_attended_seeds_checkpoint_one(self):
        _events_staff_client(self.client)
        ep = EventParticipant.objects.get(event=self.event_a)
        ep.attended = True
        ep.save()
        url = f"/api/v1/console/event-groups/{self.group.id}/participants/{ep.id}/checkpoint"
        r = self.client.post(url, {"slot": 0, "checkpoint": 2}, format="json")
        self.assertTrue(r.data["checkpoints"][0]["1"])
        self.assertIn("2", r.data["checkpoints"][0])
        self.assertTrue(r.data["attended"])

    def test_event_guide_link_marks_checkpoint_two_only(self):
        ep = EventParticipant.objects.get(event=self.event_a)
        url = f"/api/v1/guide/{self.event_a.guide_token}/participants/{ep.id}/checkpoint"
        r = self.client.post(url, {"slot": 0, "checkpoint": 1}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(list(r.data["checkpoints"][0]), ["2"])
        self.assertFalse(r.data["attended"])

        r = self.client.get(f"/api/v1/guide/{self.event_a.guide_token}/event")
        self.assertEqual(r.data["group"]["checkpoint_labels"], ["Check-in", "At site"])
        self.assertIn("2", r.data["bookings"][0]["checkpoints"][0])

        p = Participant.objects.create(first_name="S", last_name="W", email="s@x.com")
        solo_ep = EventParticipant.objects.create(event=self.ungrouped, participant=p, is_confirmed=True)
        url = f"/api/v1/guide/{self.ungrouped.guide_token}/participants/{solo_ep.id}/checkpoint"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 404)

    def test_set_checkpoint_labels(self):
        _events_staff_client(self.client)
        url = f"/api/v1/console/event-groups/{self.group.id}"
        r = self.client.patch(url, {"checkpoint_labels": ["Meeting point", " Bus "]}, format="json")
        self.assertEqual(r.data["checkpoint_labels"], ["Meeting point", "Bus"])
        self.assertEqual(self.client.patch(url, {"checkpoint_labels": ["Only one"]}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(url, {"checkpoint_labels": ["A", ""]}, format="json").status_code, 400)


class EventGroupFollowupEmailTests(APITestCase):
    """Follow-up email across every event in a group, sent in batches."""

    def setUp(self):
        EventGroup = get_model("event", "EventGroup")
        self.group = EventGroup.objects.create(name="Big Day", slug="big-day")
        self.event_a = create_event(title="Site A")
        self.event_b = create_event(title="Site B")
        self.ungrouped = create_event(title="Solo walk")
        for e in (self.event_a, self.event_b):
            e.group = self.group
            e.save()
        self.url = f"/api/v1/console/event-groups/{self.group.id}/send-followup-email"

    def _add(self, event, email, *, attended=False, **flags):
        p = Participant._default_manager.create(first_name="F", last_name="L", email=email, quantity=1)
        return EventParticipant.objects.create(
            event=event, participant=p, is_confirmed=flags.pop("is_confirmed", True), attended=attended, **flags
        )

    def _recipients(self, **data):
        r = self.client.post(self.url, {"dry_run": True, **data}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data["recipients"]

    def test_staff_only(self):
        r = self.client.post(self.url, {"dry_run": True}, format="json")
        self.assertIn(r.status_code, (401, 403))

    def test_dry_run_lists_confirmed_across_group_deduped(self):
        _events_staff_client(self.client)
        self._add(self.event_a, "a@x.com")
        self._add(self.event_b, "b@x.com")
        self._add(self.event_b, "A@x.com")  # same person at a second site
        self._add(self.event_b, "cancelled@x.com", is_cancelled=True)
        self._add(self.event_b, "waitlisted@x.com", is_confirmed=False, is_waitlisted=True)
        self._add(self.event_b, "")
        self._add(self.ungrouped, "solo@x.com")
        emails = sorted(r["email"].lower() for r in self._recipients())
        self.assertEqual(emails, ["a@x.com", "b@x.com"])

    def test_dry_run_filters_by_event_and_attendance(self):
        _events_staff_client(self.client)
        self._add(self.event_a, "a@x.com", attended=True)
        self._add(self.event_b, "b@x.com", attended=True)
        self._add(self.event_b, "c@x.com")
        self.assertEqual([r["email"] for r in self._recipients(event_ids=[self.event_b.id])], ["b@x.com", "c@x.com"])
        self.assertEqual(sorted(r["email"] for r in self._recipients(attended_only=True)), ["a@x.com", "b@x.com"])

    @patch("apps.event.utils.send_followup_email")
    def test_sends_only_requested_recipients_with_their_own_event(self, mock_send):
        _events_staff_client(self.client)
        a = self._add(self.event_a, "a@x.com")
        b = self._add(self.event_b, "b@x.com")
        solo = self._add(self.ungrouped, "solo@x.com")
        r = self.client.post(
            self.url, {"subject": "S", "body": "<p>B</p>", "ep_ids": [a.id, b.id, solo.id]}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["sent"], 2)
        self.assertEqual(sorted(r.data["sent_ep_ids"]), sorted([a.id, b.id]))
        sent = {c.args[1].email: c.args[0].id for c in mock_send.call_args_list}
        self.assertEqual(sent, {"a@x.com": self.event_a.id, "b@x.com": self.event_b.id})

    @patch("apps.event.utils.send_followup_email", side_effect=RuntimeError("smtp down"))
    def test_failures_reported_not_raised(self, mock_send):
        _events_staff_client(self.client)
        a = self._add(self.event_a, "a@x.com")
        r = self.client.post(self.url, {"subject": "S", "body": "<p>B</p>", "ep_ids": [a.id]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["sent"], 0)
        self.assertEqual(r.data["failed"], ["a@x.com"])
        # A failed copy isn't logged, so it's still pending.
        r = self.client.post(self.url, {"dry_run": True, "followup_id": r.data["followup_id"]}, format="json")
        self.assertEqual([x["email"] for x in r.data["recipients"]], ["a@x.com"])

    @patch("apps.event.utils.send_followup_email")
    def test_logs_each_copy_and_never_resends_it(self, mock_send):
        _events_staff_client(self.client)
        a = self._add(self.event_a, "a@x.com")
        b = self._add(self.event_b, "B@x.com")
        r = self.client.post(self.url, {"subject": "S", "body": "<p>B</p>", "ep_ids": [a.id]}, format="json")
        fid = r.data["followup_id"]
        # Retrying a batch whose response was lost: a@ is skipped, b@ goes out once.
        r = self.client.post(
            self.url, {"subject": "ignored", "body": "x", "followup_id": fid, "ep_ids": [a.id, b.id]}, format="json"
        )
        self.assertEqual(r.data["followup_id"], fid)
        self.assertEqual(r.data["sent_ep_ids"], [b.id])
        self.assertEqual([c.args[1].email for c in mock_send.call_args_list], ["a@x.com", "B@x.com"])
        # The saved subject is used when resuming, not whatever the client sent.
        self.assertEqual(mock_send.call_args.args[2], "S")
        r = self.client.post(self.url, {"dry_run": True, "followup_id": fid}, format="json")
        self.assertEqual((r.data["recipients"], r.data["already_sent"]), ([], 2))

        r = self.client.get(f"/api/v1/console/event-groups/{self.group.id}/followup-emails")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["sent_count"], 2)
        self.assertEqual(
            [(x["email"], x["event_title"]) for x in r.data[0]["recipients"]],
            [("a@x.com", "Site A"), ("b@x.com", "Site B")],
        )

    @patch("apps.event.utils.send_followup_email")
    def test_skip_emails_from_a_pasted_list(self, mock_send):
        _events_staff_client(self.client)
        a = self._add(self.event_a, "a@x.com")
        b = self._add(self.event_b, "b@x.com")
        c = self._add(self.event_b, "c@x.com")
        pasted = "Ann <A@x.com>, b@x.com\nsomeone@else.com"
        r = self.client.post(self.url, {"dry_run": True, "skip_emails": pasted}, format="json")
        self.assertEqual([x["email"] for x in r.data["recipients"]], ["c@x.com"])
        self.assertEqual(r.data["skipped"], 2)
        r = self.client.post(
            self.url,
            {"subject": "S", "body": "<p>B</p>", "skip_emails": pasted, "ep_ids": [a.id, b.id, c.id]},
            format="json",
        )
        self.assertEqual(r.data["sent_ep_ids"], [c.id])

    def test_unknown_followup_id(self):
        _events_staff_client(self.client)
        r = self.client.post(self.url, {"dry_run": True, "followup_id": 999}, format="json")
        self.assertEqual(r.status_code, 404)

    @patch("apps.event.utils.send_followup_email")
    def test_test_email_goes_only_to_tester(self, mock_send):
        _events_staff_client(self.client)
        self._add(self.event_a, "a@x.com")
        r = self.client.post(
            self.url, {"subject": "S", "body": "<p>B</p>", "test_email": "me@x.com"}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        mock_send.assert_called_once()
        self.assertEqual(mock_send.call_args.kwargs["to_email"], "me@x.com")

    @patch("apps.event.utils.send_followup_email")
    def test_validation(self, mock_send):
        _events_staff_client(self.client)
        a = self._add(self.event_a, "a@x.com")
        bad = [
            {"subject": "", "body": "<p>B</p>", "ep_ids": [a.id]},
            {"subject": "S", "body": "", "ep_ids": [a.id]},
            {"subject": "S", "body": "<p>B</p>"},
            {"subject": "S", "body": "<p>B</p>", "ep_ids": list(range(1, 100))},
            {"subject": "S", "body": "<p>B</p>", "test_email": "nope"},
            {"dry_run": True, "event_ids": "1"},
        ]
        for payload in bad:
            r = self.client.post(self.url, payload, format="json")
            self.assertEqual(r.status_code, 400, payload)
        mock_send.assert_not_called()

    @patch("apps.event.utils.EmailMultiAlternatives")
    def test_group_name_placeholder_renders(self, mock_email):
        from apps.event.utils import send_followup_email
        p = Participant._default_manager.create(first_name="Ann", last_name="L", email="a@x.com", quantity=1)
        send_followup_email(self.event_a, p, "{{group_name}}: {{event_title}}", "<p>Hi {{first_name}}</p>")
        self.assertEqual(mock_email.call_args.kwargs["subject"], "Big Day: Site A")


class FollowupEmailTableTests(APITestCase):
    """Tables from the console editor reach the inbox with inline styles."""

    TIPTAP_TABLE = (
        '<p>Before</p><table style="min-width: 50px"><colgroup><col style="min-width: 25px"></colgroup>'
        '<tbody><tr><th colspan="1" rowspan="1"><p>Site</p></th><th colspan="1" rowspan="1"><p>Time</p></th></tr>'
        '<tr><td colspan="1" rowspan="1"><p>{{event_title}}</p></td><td colspan="1" rowspan="1"><p>7am</p></td></tr>'
        "</tbody></table><p>After</p>"
    )

    def test_inlines_styles_only_inside_tables(self):
        from apps.event.utils import inline_email_table_styles
        html = inline_email_table_styles(self.TIPTAP_TABLE)
        self.assertTrue(html.startswith("<p>Before</p>"))
        self.assertTrue(html.endswith("<p>After</p>"))
        self.assertIn('<table style="border-collapse:collapse;', html)
        self.assertNotIn("min-width: 50px", html)
        self.assertIn('<th colspan="1" rowspan="1" style="border:1px solid #d1d5db;', html)
        self.assertIn('<td colspan="1" rowspan="1" style="border:1px solid #d1d5db;', html)
        self.assertIn('<p style="margin:0;">Site</p>', html)
        self.assertEqual(html.count("style="), 1 + 4 + 4 + 1)  # table, cells, cell paragraphs, col

    @patch("apps.event.utils.EmailMultiAlternatives")
    def test_followup_email_sends_styled_table(self, mock_email):
        from apps.event.utils import send_followup_email
        event = create_event(title="Site A")
        p = Participant._default_manager.create(first_name="Ann", last_name="L", email="a@x.com", quantity=1)
        send_followup_email(event, p, "S", self.TIPTAP_TABLE)
        html = mock_email.return_value.attach_alternative.call_args.args[0]
        self.assertIn('<p style="margin:0;">Site A</p>', html)
        self.assertIn("border-collapse:collapse", html)
