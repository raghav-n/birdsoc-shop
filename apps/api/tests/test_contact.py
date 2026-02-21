from __future__ import annotations

from unittest.mock import patch
from rest_framework.test import APITestCase

from apps.api.tests.utils import create_event


class ContactFormTests(APITestCase):
    def _valid_payload(self, **overrides):
        data = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "subject": "Test Subject",
            "body": "This is a test message body.",
            "pdpa_agreement": True,
        }
        data.update(overrides)
        return data

    @patch("apps.api.views.contact.EmailMessage.send")
    def test_valid_submission(self, mock_send):
        r = self.client.post("/api/v1/contact", self._valid_payload(), format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["success"])
        mock_send.assert_called_once()

    def test_missing_required_fields(self):
        r = self.client.post("/api/v1/contact", {}, format="json")
        self.assertEqual(r.status_code, 400)
        errors = r.data["errors"]
        for field in ("name", "email", "subject", "body", "pdpa_agreement"):
            self.assertIn(field, errors)

    def test_invalid_email(self):
        r = self.client.post(
            "/api/v1/contact",
            self._valid_payload(email="not-an-email"),
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.data["errors"])

    def test_short_name(self):
        r = self.client.post(
            "/api/v1/contact",
            self._valid_payload(name="A"),
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("name", r.data["errors"])

    def test_short_subject(self):
        r = self.client.post(
            "/api/v1/contact",
            self._valid_payload(subject="Hi"),
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("subject", r.data["errors"])

    def test_short_body(self):
        r = self.client.post(
            "/api/v1/contact",
            self._valid_payload(body="Short"),
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("body", r.data["errors"])

    def test_pdpa_not_agreed(self):
        r = self.client.post(
            "/api/v1/contact",
            self._valid_payload(pdpa_agreement=False),
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("pdpa_agreement", r.data["errors"])

    @patch("apps.api.views.contact.EmailMessage.send")
    def test_valid_event_id(self, mock_send):
        event = create_event()
        r = self.client.post(
            "/api/v1/contact",
            self._valid_payload(event_id=event.id),
            format="json",
        )
        self.assertEqual(r.status_code, 201)

    def test_invalid_event_id(self):
        r = self.client.post(
            "/api/v1/contact",
            self._valid_payload(event_id=999999),
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("event_id", r.data["errors"])

    @patch("apps.api.views.contact.EmailMessage.send", side_effect=Exception("SMTP error"))
    def test_email_send_failure_returns_500(self, mock_send):
        r = self.client.post("/api/v1/contact", self._valid_payload(), format="json")
        self.assertEqual(r.status_code, 500)
        self.assertFalse(r.data["success"])
