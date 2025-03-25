import json
from authlib.integrations.django_client import OAuth
from django.conf import settings
from django.shortcuts import redirect, render
from django.urls import reverse
from urllib.parse import quote_plus, urlencode
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth import get_user_model

User = get_user_model()

oauth = OAuth()

oauth.register(
    "auth0",
    client_id=settings.AUTH0_CLIENT_ID,
    client_secret=settings.AUTH0_CLIENT_SECRET,
    client_kwargs={
        "scope": "openid profile email",
    },
    server_metadata_url=f"https://{settings.AUTH0_DOMAIN}/.well-known/openid-configuration",
)


def login(request):
    return oauth.auth0.authorize_redirect(
        request, request.build_absolute_uri(reverse("dashboard_callback"))
    )


def callback(request):
    token = oauth.auth0.authorize_access_token(request)
    request.session["user"] = token

    user_info = token.get("userinfo", {})

    try:
        user = User.objects.get(email=user_info.get("email"))
        auth_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    except User.DoesNotExist:
        return redirect(reverse("home") + "?noaccess=1")

    return redirect(request.build_absolute_uri(reverse("dashboard:index")))


def logout(request):
    request.session.clear()
    auth_logout(request)

    return redirect(
        f"https://{settings.AUTH0_DOMAIN}/v2/logout?"
        + urlencode(
            {
                "returnTo": request.build_absolute_uri(reverse("home")),
                "client_id": settings.AUTH0_CLIENT_ID,
            },
            quote_via=quote_plus,
        ),
    )
