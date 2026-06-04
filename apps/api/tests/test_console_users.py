from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase

from apps.api.tests.utils import auth_client, create_user

LIST_URL = "/api/v1/console/users"


def _superuser_client(client, email="su@example.com"):
    User = get_user_model()
    User.objects.create_superuser(username=email, email=email, password="Passw0rd!")
    resp = client.post(
        "/api/v1/auth/token/", {"email": email, "password": "Passw0rd!"}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


class ConsoleUsersAuthTests(APITestCase):
    def test_anonymous_blocked(self):
        self.assertIn(self.client.get(LIST_URL).status_code, (401, 403))

    def test_plain_user_blocked(self):
        create_user(email="plain@example.com")
        auth_client(self.client, email="plain@example.com")
        self.assertEqual(self.client.get(LIST_URL).status_code, 403)

    def test_group_member_blocked(self):
        # A console group member is not a superuser, so cannot manage users.
        group, _ = Group.objects.get_or_create(name="Merch Management")
        user = create_user(email="mgmt@example.com")
        user.groups.add(group)
        auth_client(self.client, email="mgmt@example.com")
        self.assertEqual(self.client.get(LIST_URL).status_code, 403)
        target = create_user(email="target@example.com")
        r = self.client.patch(f"{LIST_URL}/{target.id}", {"groups": []}, format="json")
        self.assertEqual(r.status_code, 403)


class ConsoleUsersListTests(APITestCase):
    def setUp(self):
        _superuser_client(self.client)

    def test_default_list_shows_console_members(self):
        member = create_user(email="member@example.com")
        member.groups.add(Group.objects.get_or_create(name="Events")[0])
        # A user with no groups and not staff should be hidden by default.
        create_user(email="nobody@example.com")
        emails = {u["email"] for u in self.client.get(LIST_URL).data}
        self.assertIn("member@example.com", emails)
        self.assertNotIn("nobody@example.com", emails)

    def test_search_finds_any_user(self):
        create_user(email="findme@example.com", first_name="Zelda")
        r = self.client.get(f"{LIST_URL}?search=zelda")
        emails = {u["email"] for u in r.data}
        self.assertIn("findme@example.com", emails)


class ConsoleUsersUpdateTests(APITestCase):
    def setUp(self):
        _superuser_client(self.client)

    def test_assign_groups_sets_membership_and_staff(self):
        target = create_user(email="t@example.com")
        self.assertFalse(target.is_staff)
        r = self.client.patch(
            f"{LIST_URL}/{target.id}",
            {"groups": ["Merch Sales", "Events"]},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertCountEqual(r.data["groups"], ["Merch Sales", "Events"])
        target.refresh_from_db()
        self.assertTrue(target.is_staff)

    def test_removing_all_groups_revokes_staff(self):
        target = create_user(email="t@example.com")
        for name in ["Merch Sales", "Events"]:
            target.groups.add(Group.objects.get_or_create(name=name)[0])
        target.is_staff = True
        target.save()
        r = self.client.patch(f"{LIST_URL}/{target.id}", {"groups": []}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["groups"], [])
        target.refresh_from_db()
        self.assertFalse(target.is_staff)

    def test_superuser_keeps_staff_when_groups_removed(self):
        User = get_user_model()
        target = User.objects.create_superuser(
            username="other_su@example.com", email="other_su@example.com", password="x"
        )
        r = self.client.patch(f"{LIST_URL}/{target.id}", {"groups": []}, format="json")
        self.assertEqual(r.status_code, 200)
        target.refresh_from_db()
        self.assertTrue(target.is_staff)

    def test_preserves_unmanaged_groups(self):
        target = create_user(email="t@example.com")
        target.groups.add(Group.objects.get_or_create(name="SomeOtherGroup")[0])
        r = self.client.patch(
            f"{LIST_URL}/{target.id}", {"groups": ["Events"]}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("SomeOtherGroup", r.data["groups"])
        self.assertIn("Events", r.data["groups"])
        self.assertNotIn("Merch Sales", r.data["groups"])

    def test_invalid_group_rejected(self):
        target = create_user(email="t@example.com")
        r = self.client.patch(
            f"{LIST_URL}/{target.id}", {"groups": ["Nope"]}, format="json"
        )
        self.assertEqual(r.status_code, 400)

    def test_groups_must_be_list(self):
        target = create_user(email="t@example.com")
        r = self.client.patch(
            f"{LIST_URL}/{target.id}", {"groups": "Events"}, format="json"
        )
        self.assertEqual(r.status_code, 400)
