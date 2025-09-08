from __future__ import annotations

from rest_framework.test import APITestCase

from apps.api.tests.utils import create_shipping_method


class MiscExtraTests(APITestCase):
    def test_shipping_methods_filter_self_collect(self):
        m1 = create_shipping_method(is_self_collect=True)
        m2 = create_shipping_method(is_self_collect=False)

        r = self.client.get("/api/v1/shipping/methods", {"self_collect": "true"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(all(i["is_self_collect"] for i in r.data))

        r = self.client.get("/api/v1/shipping/methods", {"self_collect": "false"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(all(not i["is_self_collect"] for i in r.data))
