from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient

from apps.api.tests.utils import auth_client, create_user


class AuthExtraTests(APITestCase):
    def test_token_refresh_and_me_patch(self):
        email = "refreshme@example.com"
        password = "Passw0rd!"
        create_user(email=email, password=password)

        # Obtain pair
        r = self.client.post(
            "/api/v1/auth/token/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        refresh = r.data.get("refresh")
        access = r.data.get("access")
        self.assertTrue(refresh)
        self.assertTrue(access)

        # Refresh token
        r = self.client.post(
            "/api/v1/auth/token/refresh/", {"refresh": refresh}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data.get("access"))

        # Patch profile
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        r = self.client.patch(
            "/api/v1/users/me/",
            {"first_name": "New", "last_name": "Name"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["first_name"], "New")
        self.assertEqual(r.data["last_name"], "Name")

    def test_register_validations_and_bad_login(self):
        # Missing fields
        r = self.client.post("/api/v1/auth/register/", {}, format="json")
        self.assertEqual(r.status_code, 400)

        # Duplicate email
        email = "dupe@example.com"
        create_user(email=email)
        r = self.client.post(
            "/api/v1/auth/register/", {"email": email, "password": "Passw0rd!"}, format="json"
        )
        self.assertEqual(r.status_code, 400)

        # Bad login
        r = self.client.post(
            "/api/v1/auth/token/", {"email": email, "password": "wrong"}, format="json"
        )
        self.assertEqual(r.status_code, 401)

    def test_password_reset_validations(self):
        # Missing email
        r = self.client.post("/api/v1/auth/password/reset/", {}, format="json")
        self.assertEqual(r.status_code, 400)

        # Invalid confirm payload
        r = self.client.post(
            "/api/v1/auth/password/reset/confirm/",
            {"uid": "", "token": "", "new_password": ""},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

