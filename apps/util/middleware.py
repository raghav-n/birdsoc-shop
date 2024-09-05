from django.http import Http404
from django.shortcuts import redirect
from django.conf import settings
from django.urls import reverse


class LoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.login_url = settings.LOGIN_ONLY_URL
        self.open_urls = [
            self.login_url,
            reverse("password-reset"),
            reverse("password-reset-done"),
            "password-reset/confirm/",
            reverse("password-reset-complete"),
        ] + getattr(settings, "OPEN_URLS", [])

    def __call__(self, request):
        if (
            not request.user.is_authenticated
            and not request.path_info in self.open_urls
        ):
            return redirect(self.login_url + "?next=" + request.path)

        return self.get_response(request)


class NoAdminMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/admin/"):
            if (
                not request.user.is_authenticated
                or not request.user.email in settings.ADMIN_EMAILS
            ):
                raise Http404()
        response = self.get_response(request)
        return response
