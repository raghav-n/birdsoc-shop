from __future__ import annotations

from rest_framework.test import APITestCase

from apps.payment.models import Donation


class DonationCreateTests(APITestCase):
    def _valid_payload(self, **overrides):
        data = {
            "name": "Alice Tan",
            "amount": "20.00",
            "reference": "DONATION-ALICE_TAN",
        }
        data.update(overrides)
        return data

    def test_valid_donation_creates_record(self):
        r = self.client.post("/api/v1/donations", self._valid_payload(), format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["success"])
        self.assertEqual(Donation.objects.count(), 1)
        donation = Donation.objects.first()
        self.assertEqual(donation.name, "Alice Tan")
        self.assertEqual(str(donation.amount), "20.00")
        self.assertEqual(donation.reference, "DONATION-ALICE_TAN")

    def test_optional_fields_saved(self):
        r = self.client.post(
            "/api/v1/donations",
            self._valid_payload(email="alice@example.com", note="Keep up the good work!"),
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        donation = Donation.objects.first()
        self.assertEqual(donation.email, "alice@example.com")
        self.assertEqual(donation.note, "Keep up the good work!")

    def test_missing_name_returns_400(self):
        r = self.client.post("/api/v1/donations", self._valid_payload(name=""), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("name", r.data["errors"])
        self.assertEqual(Donation.objects.count(), 0)

    def test_missing_amount_returns_400(self):
        payload = self._valid_payload()
        del payload["amount"]
        r = self.client.post("/api/v1/donations", payload, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("amount", r.data["errors"])

    def test_zero_amount_returns_400(self):
        r = self.client.post("/api/v1/donations", self._valid_payload(amount="0"), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("amount", r.data["errors"])

    def test_negative_amount_returns_400(self):
        r = self.client.post("/api/v1/donations", self._valid_payload(amount="-5"), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("amount", r.data["errors"])

    def test_invalid_amount_returns_400(self):
        r = self.client.post(
            "/api/v1/donations", self._valid_payload(amount="not-a-number"), format="json"
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("amount", r.data["errors"])

    def test_missing_reference_returns_400(self):
        r = self.client.post(
            "/api/v1/donations", self._valid_payload(reference=""), format="json"
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("reference", r.data["errors"])

    def test_reference_truncated_to_25_chars(self):
        long_ref = "DONATION-" + "X" * 30
        r = self.client.post(
            "/api/v1/donations", self._valid_payload(reference=long_ref), format="json"
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(Donation.objects.first().reference), 25)

    def test_whitespace_stripped_from_name(self):
        r = self.client.post(
            "/api/v1/donations", self._valid_payload(name="  Bob Lim  "), format="json"
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Donation.objects.first().name, "Bob Lim")
