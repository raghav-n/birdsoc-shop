from __future__ import annotations

from rest_framework.test import APITestCase
from apps.faq.models import FAQItem


class FAQTests(APITestCase):
    def setUp(self):
        # Clear seeded FAQ data so tests have a clean slate
        FAQItem.objects.all().delete()

    def test_list_active_faq_items(self):
        FAQItem.objects.create(question="Q1?", answer="A1", position=1, is_active=True)
        FAQItem.objects.create(question="Q2?", answer="A2", position=0, is_active=True)
        FAQItem.objects.create(question="Hidden?", answer="X", position=2, is_active=False)

        r = self.client.get("/api/v1/faq")
        self.assertEqual(r.status_code, 200)
        # Only active items returned
        self.assertEqual(len(r.data), 2)
        # Ordered by position
        self.assertEqual(r.data[0]["question"], "Q2?")
        self.assertEqual(r.data[1]["question"], "Q1?")

    def test_inactive_items_excluded(self):
        FAQItem.objects.create(question="Active?", answer="Yes", is_active=True)
        FAQItem.objects.create(question="Inactive?", answer="No", is_active=False)

        r = self.client.get("/api/v1/faq")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["question"], "Active?")

    def test_empty_faq_returns_empty_list(self):
        r = self.client.get("/api/v1/faq")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, [])
