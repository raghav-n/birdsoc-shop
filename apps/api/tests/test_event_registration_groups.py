from __future__ import annotations

from decimal import Decimal
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from oscar.core.loading import get_model

from apps.api.tests.utils import create_event


EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")
EventParticipant = get_model("event", "EventParticipant")


class BulkRegistrationTests(APITestCase):
    """Tests for POST /api/v1/events/<pk>/register/bulk"""

    def _paid_event(self, price="5.00", **kwargs):
        e = create_event(**kwargs)
        e.price_incl_tax = Decimal(price)
        e.save()
        return e

    def test_bulk_register_paid_creates_group(self):
        e = self._paid_event()
        payload = {
            "participants": [
                {"first_name": "A", "last_name": "X", "email": "a@x.com", "quantity": 1},
                {"first_name": "B", "last_name": "Y", "email": "b@y.com", "quantity": 2},
            ],
            "payer_name": "Payer",
            "payer_email": "payer@example.com",
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("group", r.data)
        self.assertEqual(r.data["group"]["amount_total"], "15.00")  # 5*1 + 5*2
        self.assertEqual(r.data["totals"]["quantity"], 3)
        self.assertEqual(len(r.data["items"]), 2)

    def test_bulk_register_free_confirms_immediately(self):
        e = create_event()
        e.price_incl_tax = Decimal("0.00")
        e.save()
        payload = {
            "participants": [
                {"first_name": "F", "last_name": "R", "email": "fr@x.com", "quantity": 1},
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data.get("all_confirmed"))
        self.assertNotIn("group", r.data)

    def test_bulk_register_missing_participants(self):
        e = create_event()
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", {}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_bulk_register_empty_list(self):
        e = create_event()
        r = self.client.post(
            f"/api/v1/events/{e.id}/register/bulk", {"participants": []}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_bulk_register_invalid_participant_data(self):
        e = create_event()
        payload = {
            "participants": [
                {"first_name": "", "last_name": "B", "email": "a@b.com", "quantity": 1},
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 400)

    def test_bulk_register_event_not_found(self):
        r = self.client.post(
            "/api/v1/events/999999/register/bulk",
            {"participants": [{"first_name": "A", "last_name": "B", "email": "a@b.com"}]},
            format="json",
        )
        self.assertEqual(r.status_code, 404)

    def test_bulk_register_capacity_exceeded(self):
        e = self._paid_event(max_participants=2)
        payload = {
            "participants": [
                {"first_name": "A", "last_name": "X", "email": "a@x.com", "quantity": 2},
                {"first_name": "B", "last_name": "Y", "email": "b@y.com", "quantity": 1},
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("spots remaining", r.data["detail"])

    def test_bulk_register_with_custom_reference(self):
        e = self._paid_event()
        payload = {
            "participants": [
                {"first_name": "R", "last_name": "F", "email": "rf@x.com", "quantity": 1},
            ],
            "reference": "MY-REF-123",
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["group"]["reference"], "MY-REF-123")

    def test_bulk_register_duplicate_reference_rejected(self):
        e = self._paid_event()
        base = {
            "participants": [
                {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            ],
            "reference": "UNIQUE-REF",
        }
        r1 = self.client.post(f"/api/v1/events/{e.id}/register/bulk", base, format="json")
        self.assertEqual(r1.status_code, 201)

        base["participants"][0]["email"] = "c@d.com"
        r2 = self.client.post(f"/api/v1/events/{e.id}/register/bulk", base, format="json")
        self.assertEqual(r2.status_code, 409)

    def test_bulk_register_invalid_reference_format(self):
        e = self._paid_event()
        payload = {
            "participants": [
                {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            ],
            "reference": "lowercase!",
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 400)

    def test_bulk_register_with_donation(self):
        e = self._paid_event()
        payload = {
            "participants": [
                {"first_name": "D", "last_name": "N", "email": "dn@x.com", "quantity": 1},
            ],
            "donation": 3,
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["group"]["donation_amount"], "3")

    def test_bulk_register_invalid_payer_email(self):
        e = self._paid_event()
        payload = {
            "participants": [
                {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": 1},
            ],
            "payer_email": "not-valid",
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 400)


class EventRegistrationGroupDetailTests(APITestCase):
    """Tests for GET /api/v1/event-registration-groups/<id>"""

    def test_group_detail(self):
        e = create_event()
        e.price_incl_tax = Decimal("10.00")
        e.save()

        payload = {
            "participants": [
                {"first_name": "G", "last_name": "D", "email": "gd@x.com", "quantity": 1},
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        group_id = r.data["group"]["id"]

        r = self.client.get(f"/api/v1/event-registration-groups/{group_id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], group_id)
        self.assertEqual(r.data["event"], e.id)
        self.assertEqual(len(r.data["items"]), 1)
        self.assertEqual(r.data["items"][0]["participant"]["email"], "gd@x.com")

    def test_group_detail_not_found(self):
        r = self.client.get("/api/v1/event-registration-groups/999999")
        self.assertEqual(r.status_code, 404)


class EventRegistrationGroupProofUploadTests(APITestCase):
    """Tests for POST /api/v1/event-registration-groups/<id>/payment/paynow-proof"""

    def _create_group(self):
        e = create_event()
        e.price_incl_tax = Decimal("7.00")
        e.save()
        payload = {
            "participants": [
                {"first_name": "P", "last_name": "U", "email": "pu@x.com", "quantity": 1},
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        return r.data["group"]["id"]

    def test_upload_proof(self):
        group_id = self._create_group()
        img = SimpleUploadedFile("proof.png", b"fake-img", content_type="image/png")
        r = self.client.post(
            f"/api/v1/event-registration-groups/{group_id}/payment/paynow-proof",
            {"payment_proof": img},
            format="multipart",
        )
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["uploaded"])

    def test_upload_proof_missing_file(self):
        group_id = self._create_group()
        r = self.client.post(
            f"/api/v1/event-registration-groups/{group_id}/payment/paynow-proof",
            {},
            format="multipart",
        )
        self.assertEqual(r.status_code, 400)

    def test_upload_proof_not_found(self):
        img = SimpleUploadedFile("proof.png", b"fake-img", content_type="image/png")
        r = self.client.post(
            "/api/v1/event-registration-groups/999999/payment/paynow-proof",
            {"payment_proof": img},
            format="multipart",
        )
        self.assertEqual(r.status_code, 404)
