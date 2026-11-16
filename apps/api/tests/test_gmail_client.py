from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from apps.util import gmail_client


@override_settings(
    GMAIL_CLIENT_ID="id", GMAIL_CLIENT_SECRET="secret", GMAIL_REFRESH_TOKEN="tok"
)
class GmailClientTimeoutTests(SimpleTestCase):
    def test_service_uses_http_and_refresh_with_timeout(self):
        captured = {}

        def fake_refresh(self, request):
            captured["refresh_request"] = request

        with patch(
            "google.oauth2.credentials.Credentials.refresh", fake_refresh
        ), patch("googleapiclient.discovery.build") as build:
            build.return_value = MagicMock()
            gmail_client.build_gmail_service()

        http = build.call_args.kwargs["http"]
        self.assertEqual(
            http.http.timeout, gmail_client.GMAIL_HTTP_TIMEOUT_SECONDS
        )
        self.assertNotIn("credentials", build.call_args.kwargs)

        with patch("requests.Session.request") as req:
            req.return_value = MagicMock(
                status_code=200, headers={}, content=b""
            )
            captured["refresh_request"]("https://example.com")
        self.assertEqual(
            req.call_args.kwargs["timeout"], gmail_client.GMAIL_HTTP_TIMEOUT_SECONDS
        )
