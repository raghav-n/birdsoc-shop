"""The bank puts the payer's PayNow purpose code (OTHR, GDDS, ...) in front of
our reference. The Gmail matchers must find the reference whatever the code."""

import base64

from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from apps.util.gmail_client import (
    find_paynow_email_for_event_registration,
    find_paynow_email_for_order,
)


def _alert(reference: str, amount: str = "28.00") -> str:
    return (
        "Dear Valued Customer\n\n"
        f"S${amount} has been credited into your A/C ending 8024 (ref-{reference}) "
        "from A PAYER on 16 November 2026 at 11:03 (Singapore time).\n\n"
        "Thank you for banking with Maybank."
    )


class _FakeGmail:
    """Just enough of the Gmail API for the matchers: one message per body."""

    def __init__(self, *bodies):
        self.bodies = bodies
        self.queries = []

    def users(self):
        return self

    def messages(self):
        return self

    def list(self, userId, q, maxResults):
        self.queries.append(q)
        self._result = {"messages": [{"id": str(i)} for i in range(len(self.bodies))]}
        return self

    def get(self, userId, id, format):
        body = self.bodies[int(id)]
        self._result = {
            "internalDate": str(int(timezone.now().timestamp() * 1000)),
            "payload": {
                "headers": [{"name": "From", "value": "Bank <alerts@bank.example>"}],
                "mimeType": "text/plain",
                "body": {"data": base64.urlsafe_b64encode(body.encode()).decode()},
            },
        }
        return self

    def execute(self):
        return self._result


@override_settings(GMAIL_ALLOWED_FROM_ADDRESSES="alerts@bank.example", DEFAULT_FROM_EMAIL="")
class PurposeCodeTests(SimpleTestCase):
    def test_order_found_with_any_purpose_code(self):
        for code in ("OTHR", "GDDS", "SUPP"):
            with self.subTest(code=code):
                gmail = _FakeGmail(_alert(f"{code}-MER-2ZRPD3"))
                result = find_paynow_email_for_order(gmail, "2ZRPD3")
                self.assertIsNotNone(result)
                self.assertEqual(result["amount"], "28.00")

    def test_order_found_without_purpose_code(self):
        result = find_paynow_email_for_order(_FakeGmail(_alert("MER-2ZRPD3")), "2ZRPD3")
        self.assertIsNotNone(result)

    def test_order_reference_must_still_match_exactly(self):
        gmail = _FakeGmail(_alert("GDDS-MER-2ZRPD4"), _alert("GDDS-XMER-2ZRPD3"))
        self.assertIsNone(find_paynow_email_for_order(gmail, "2ZRPD3"))

    def test_event_registration_found_with_goods_purpose_code(self):
        gmail = _FakeGmail(_alert("GDDS-EV-12-45", amount="15.00"))
        result = find_paynow_email_for_event_registration(gmail, "EV-12-45")
        self.assertIsNotNone(result)
        self.assertEqual(result["amount"], "15.00")

    def test_group_event_registration_found_with_goods_purpose_code(self):
        gmail = _FakeGmail(_alert("GDDS-EVG-12-7", amount="30.00"))
        self.assertIsNotNone(find_paynow_email_for_event_registration(gmail, "EVG-12-7"))

    def test_individual_reference_does_not_match_group_payment(self):
        gmail = _FakeGmail(_alert("GDDS-EVG-12-45"))
        self.assertIsNone(find_paynow_email_for_event_registration(gmail, "EV-12-45"))
