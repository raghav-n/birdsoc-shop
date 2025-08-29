from __future__ import annotations

from decimal import Decimal
import jwt

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from oscar.core.loading import get_model

from apps.api.tests.utils import create_event


OrganizedEvent = get_model("event", "OrganizedEvent")
EventParticipant = get_model("event", "EventParticipant")
EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")


class EventsAndRegistrationsExtraTests(APITestCase):

    def test_register_missing_fields_and_bad_quantity(self):
        e = create_event()
        # Missing core fields
        r = self.client.post(f"/api/v1/events/{e.id}/register", {}, format="json")
        self.assertEqual(r.status_code, 400)

        # Non-integer quantity
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {"first_name": "A", "last_name": "B", "email": "a@b.com", "quantity": "x"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("quantity", r.data.get("detail", ""))

    def test_register_free_event_confirms_immediately(self):
        e = create_event(max_participants=3)
        e.price_incl_tax = Decimal("0.00")
        e.save()

        payload = {
            "first_name": "Free",
            "last_name": "User",
            "email": "free@example.com",
            "quantity": 1,
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register", payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data.get("confirmed"))

        # Participant is confirmed in DB
        self.assertEqual(
            EventParticipant._default_manager.filter(event=e, is_confirmed=True).count(),
            1,
        )
        # No EventRegistration for free events
        self.assertEqual(EventRegistration._default_manager.filter(event=e).count(), 0)

    def test_register_paid_event_pending_and_proof_in_register(self):
        e = create_event(max_participants=10)
        e.price_incl_tax = Decimal("12.50")
        e.currency = "SGD"
        e.save()

        img = SimpleUploadedFile(
            "proof.jpg", b"fake-image-bytes", content_type="image/jpeg"
        )
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {
                "first_name": "Paid",
                "last_name": "User",
                "email": "paid@example.com",
                "quantity": 2,
                "payment_proof": img,
            },
            format="multipart",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertFalse(r.data.get("confirmed"))

        reg = r.data["registration"]
        self.assertEqual(reg["amount"], "25.00")
        self.assertEqual(reg["currency"], "SGD")
        reg_id = reg["id"]

        # EventParticipant is not confirmed yet
        ep = EventParticipant._default_manager.get(event=e)
        self.assertFalse(ep.is_confirmed)

        # Payment proof saved
        dbreg = EventRegistration._default_manager.get(id=reg_id)
        self.assertTrue(dbreg.payment_proof)
        # pending_count reflects quantity
        e = OrganizedEvent._default_manager.get(id=e.id)
        self.assertEqual(e.pending_count, 2)

    def test_capacity_enforced_for_paid_using_pending(self):
        e = create_event(max_participants=3)
        e.price_incl_tax = Decimal("1.00")
        e.save()

        # First holds 2 pending
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {
                "first_name": "A",
                "last_name": "A",
                "email": "a@example.com",
                "quantity": 2,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)

        # Next request for 2 should fail (only 1 remaining due to pending)
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {
                "first_name": "B",
                "last_name": "B",
                "email": "b@example.com",
                "quantity": 2,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_duplicate_email_case_insensitive(self):
        e = create_event()
        e.price_incl_tax = Decimal("0.00")
        e.save()

        p1 = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "User@Example.com",
            "quantity": 1,
        }
        p2 = {**p1, "email": "user@example.com"}

        r = self.client.post(f"/api/v1/events/{e.id}/register", p1, format="json")
        self.assertEqual(r.status_code, 201, r.data)

        r = self.client.post(f"/api/v1/events/{e.id}/register", p2, format="json")
        self.assertEqual(r.status_code, 400)

    def test_same_email_different_event_allowed(self):
        e1 = create_event()
        e2 = create_event()
        for ev in (e1, e2):
            ev.price_incl_tax = Decimal("0.00")
            ev.save()

        payload = {
            "first_name": "Sam",
            "last_name": "Lee",
            "email": "sam@example.com",
            "quantity": 1,
        }
        r1 = self.client.post(f"/api/v1/events/{e1.id}/register", payload, format="json")
        r2 = self.client.post(f"/api/v1/events/{e2.id}/register", payload, format="json")
        self.assertEqual(r1.status_code, 201, r1.data)
        self.assertEqual(r2.status_code, 201, r2.data)

    def test_registration_detail_and_proof_upload(self):
        e = create_event()
        e.price_incl_tax = Decimal("9.99")
        e.save()

        # Create paid registration
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {
                "first_name": "Pat",
                "last_name": "V",
                "email": "pat@example.com",
                "quantity": 1,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        reg_id = r.data["registration"]["id"]

        # Detail
        r = self.client.get(f"/api/v1/event-registrations/{reg_id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], reg_id)
        self.assertEqual(r.data["amount"], "9.99")
        self.assertFalse(r.data["payment_verified"])

        # 404 for missing
        r = self.client.get("/api/v1/event-registrations/9999999")
        self.assertEqual(r.status_code, 404)

        # Upload proof
        img = SimpleUploadedFile("receipt.png", b"img", content_type="image/png")
        r = self.client.post(
            f"/api/v1/event-registrations/{reg_id}/payment/paynow-proof",
            {"payment_proof": img},
            format="multipart",
        )
        self.assertEqual(r.status_code, 201, r.data)

        # Missing file
        r = self.client.post(
            f"/api/v1/event-registrations/{reg_id}/payment/paynow-proof",
            {},
            format="multipart",
        )
        self.assertEqual(r.status_code, 400)

    def test_verify_event_payment_success_and_idempotency(self):
        e = create_event()
        e.price_incl_tax = Decimal("5.00")
        e.save()

        # Create registration
        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {
                "first_name": "Idem",
                "last_name": "Potent",
                "email": "idem@example.com",
                "quantity": 3,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        reg_id = r.data["registration"]["id"]
        amount = r.data["registration"]["amount"]

        # Sign JWT with payload (registration_id + amount)
        token = jwt.encode(
            {"registration_id": reg_id, "amount": amount}, settings.JWT_SECRET, algorithm="HS256"
        )
        r = self.client.post(
            "/api/verify-event-payment/",
            {},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r.status_code, 200, r.json())

        # Confirm DB state updated
        reg = EventRegistration._default_manager.get(id=reg_id)
        self.assertTrue(reg.payment_verified)
        self.assertEqual(reg.status, "paid")
        ep = EventParticipant._default_manager.get(event=e, participant=reg.participant)
        self.assertTrue(ep.is_confirmed)

        # Second call is idempotent-safe: returns 400 already paid
        r = self.client.post(
            "/api/verify-event-payment/",
            {},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r.status_code, 400)

    def test_verify_event_payment_amount_mismatch(self):
        e = create_event()
        e.price_incl_tax = Decimal("2.00")
        e.save()

        r = self.client.post(
            f"/api/v1/events/{e.id}/register",
            {
                "first_name": "Amy",
                "last_name": "B",
                "email": "ab@example.com",
                "quantity": 2,
            },
            format="json",
        )
        reg_id = r.data["registration"]["id"]

        # Wrong amount
        token = jwt.encode(
            {"registration_id": reg_id, "amount": "1.00"}, settings.JWT_SECRET, algorithm="HS256"
        )
        r = self.client.post(
            "/api/verify-event-payment/",
            {},
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(r.status_code, 400)

    def test_verify_event_group_payment_success_and_idempotency(self):
        e = create_event()
        e.price_incl_tax = Decimal("5.00")
        e.save()

        # Create a paid bulk registration (2 participants)
        payload = {
            "participants": [
                {"first_name": "G1", "last_name": "A", "email": "g1@example.com", "quantity": 1},
                {"first_name": "G2", "last_name": "B", "email": "g2@example.com", "quantity": 2},
            ]
        }
        r = self.client.post(f"/api/v1/events/{e.id}/register/bulk", payload, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("group", r.data)
        group = r.data["group"]
        group_id = group["id"]
        amount_total = group["amount_total"]

        # Verify via webhook using group_id + amount
        token = jwt.encode(
            {"group_id": group_id, "amount": amount_total}, settings.JWT_SECRET, algorithm="HS256"
        )
        r = self.client.post("/api/verify-event-payment/", {}, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(r.status_code, 200, r.json())

        # Check DB states
        grp = EventRegistrationGroup._default_manager.get(id=group_id)
        self.assertTrue(grp.payment_verified)
        # All child registrations paid and participants confirmed
        regs = grp.registrations.all()
        self.assertTrue(all(rg.payment_verified and rg.status == "paid" for rg in regs))
        for rg in regs:
            ep = EventParticipant._default_manager.get(event=e, participant=rg.participant)
            self.assertTrue(ep.is_confirmed)

        # Second call should be idempotent-safe (400 already paid)
        r = self.client.post("/api/verify-event-payment/", {}, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(r.status_code, 400)
