from django.conf import settings


def whitelist(request):
    return {
        "whitelist": (
            request.user.is_staff
            or (
                hasattr(request.user, "email")
                and request.user.email in settings.WHITELIST_USERS
            )
        )
    }
