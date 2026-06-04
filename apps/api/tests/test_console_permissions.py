from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase

from apps.api.tests.utils import auth_client, create_user


def _group_client(client, email, group_name):
    group, _ = Group.objects.get_or_create(name=group_name)
    user = create_user(email=email)
    user.groups.add(group)
    auth_client(client, email=email)
    return client


def _superuser_client(client, email="su@example.com"):
    User = get_user_model()
    User.objects.create_superuser(username=email, email=email, password="Passw0rd!")
    resp = client.post(
        "/api/v1/auth/token/", {"email": email, "password": "Passw0rd!"}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


ONSITE = "/api/v1/onsite/calculate"
ORDERS = "/api/v1/orders/search"
ANALYTICS = "/api/v1/analytics/dashboard"


class MerchPermissionTests(APITestCase):
    def _can(self, url, method="get"):
        fn = getattr(self.client, method)
        r = fn(url, {} if method == "post" else None, format="json") if method == "post" else fn(url)
        return r.status_code

    def test_merch_sales_member(self):
        _group_client(self.client, "sales@example.com", "Merch Sales")
        self.assertEqual(self.client.post(ONSITE, {}, format="json").status_code, 200)
        self.assertEqual(self.client.get(ORDERS).status_code, 200)
        self.assertEqual(self.client.get(ANALYTICS).status_code, 403)

    def test_merch_management_member(self):
        _group_client(self.client, "mgmt@example.com", "Merch Management")
        # Merch Management is a superset of Merch Sales.
        self.assertEqual(self.client.post(ONSITE, {}, format="json").status_code, 200)
        self.assertEqual(self.client.get(ORDERS).status_code, 200)
        self.assertNotEqual(self.client.get(ANALYTICS).status_code, 403)

    def test_events_member_blocked_from_merch(self):
        _group_client(self.client, "events@example.com", "Events")
        self.assertEqual(self.client.post(ONSITE, {}, format="json").status_code, 403)
        self.assertEqual(self.client.get(ORDERS).status_code, 403)
        self.assertEqual(self.client.get(ANALYTICS).status_code, 403)

    def test_plain_user_blocked(self):
        create_user(email="plain@example.com")
        auth_client(self.client, email="plain@example.com")
        self.assertEqual(self.client.post(ONSITE, {}, format="json").status_code, 403)
        self.assertEqual(self.client.get(ORDERS).status_code, 403)
        self.assertEqual(self.client.get(ANALYTICS).status_code, 403)

    def test_superuser_allowed_everywhere(self):
        _superuser_client(self.client)
        self.assertEqual(self.client.post(ONSITE, {}, format="json").status_code, 200)
        self.assertEqual(self.client.get(ORDERS).status_code, 200)
        self.assertNotEqual(self.client.get(ANALYTICS).status_code, 403)
