from debug_toolbar.middleware import show_toolbar
from django.http import Http404
from django.shortcuts import redirect
from django.conf import settings
from django.urls import reverse

from apps.util.context_processors import whitelist


class LoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

        if settings.SHOP_OPEN:
            self.login_url = settings.LOGIN_ONLY_URL
        else:
            self.login_url = reverse("dashboard:login")

        self.open_urls = [
            self.login_url,
            reverse("password-reset"),
            reverse("password-reset-done"),
            "password-reset/confirm/",
            reverse("password-reset-complete"),
        ] + getattr(settings, "OPEN_URLS", [])

    def __call__(self, request):
        request.session["method_id"] = request.GET.get(
            "method_id", request.session.get("method_id")
        )

        if (
            not request.user.is_staff
            and not whitelist(request)["whitelist"]
            and not any(open_url in request.path_info for open_url in self.open_urls)
            and request.path_info != "/"
            and "accounts/" not in request.path_info
        ):
            if "/dashboard" in request.path_info:
                if any(
                    request.path_info.startswith(url)
                    for url in [
                        "/dashboard/login",
                        "/dashboard/logout",
                        "/dashboard/callback",
                    ]
                ):
                    return self.get_response(request)

            if not settings.SHOP_OPEN and "/dashboard" not in request.path_info:
                return redirect("/")

            return redirect(self.login_url + "?next=" + request.path)

        return self.get_response(request)


class NoAdminMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/admin/"):
            if (
                not request.user.is_authenticated
                or request.user.email not in settings.ADMIN_EMAILS
            ):
                raise Http404()
        response = self.get_response(request)
        return response


def show_debug_toolbar(request):
    return show_toolbar(request) and request.path_info not in ["", "/"]
