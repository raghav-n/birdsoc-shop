import json
from authlib.integrations.django_client import OAuth
from django.conf import settings
from django.shortcuts import redirect, render
from django.urls import reverse
from urllib.parse import quote_plus, urlencode
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth import get_user_model
from django.middleware.csrf import rotate_token
import secrets

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
    # Add CSRF protection by including state parameter
    # Generate and store a state parameter to prevent CSRF attacks
    state = secrets.token_urlsafe(32)
    request.session["auth0_state"] = state

    next_url = request.GET.get("next")
    if next_url:
        request.session["auth0_next"] = next_url

    return oauth.auth0.authorize_redirect(
        request, request.build_absolute_uri(reverse("dashboard_callback")), state=state
    )


def callback(request):
    # Verify state parameter to prevent CSRF attacks
    stored_state = request.session.pop("auth0_state", None)
    incoming_state = request.GET.get("state")

    if not stored_state or stored_state != incoming_state:
        return redirect(reverse("home") + "?error=invalid_state")

    token = oauth.auth0.authorize_access_token(request)
    request.session["user"] = token

    user_info = token.get("userinfo", {})

    # Validate email is present before attempting login
    if not user_info.get("email"):
        return redirect(reverse("home") + "?error=missing_email")

    try:
        user = User.objects.get(email=user_info.get("email"))

        # Check if user is active before login
        if not user.is_active:
            return redirect(reverse("home") + "?error=account_inactive")

        auth_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        rotate_token(request)

    except User.DoesNotExist:
        return redirect(reverse("home") + "?noaccess=1")

    next_url = request.session.pop("auth0_next", None)
    if next_url:
        return redirect(next_url)
    return redirect(reverse("dashboard:index"))


def logout(request):
    request.session.clear()
    auth_logout(request)
    rotate_token(request)

    # Then redirect to Auth0 logout
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
