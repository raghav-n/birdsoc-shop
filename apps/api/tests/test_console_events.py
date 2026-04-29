from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from oscar.core.loading import get_model
from rest_framework.test import APITestCase

from apps.api.tests.utils import auth_client, create_event, create_user


OrganizedEvent = get_model("event", "OrganizedEvent")
EventParticipant = get_model("event", "EventParticipant")
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
        self.assertIn("participants", r.data)
        self.assertIn("registrations", r.data)
        self.assertIn("groups", r.data)
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
        self.assertEqual(len(r.data["participants"]), 1)
        self.assertEqual(r.data["participants"][0]["email"], "jo@test.com")

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
