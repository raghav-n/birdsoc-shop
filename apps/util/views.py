import sys

from django.db import OperationalError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from sentry_sdk import last_event_id


def handler500(request: HttpRequest, *args, **argv) -> HttpResponse:
    """
    Custom 500 error handler.
    """
    type_, value, traceback = sys.exc_info()
    traffic = False

    if isinstance(value, OperationalError):
        traffic = True

    return render(
        request,
        "500.html",
        {
            "sentry_event_id": last_event_id(),
            "traffic": traffic,
        },
        status=500,
    )


def handler404(request: HttpRequest, *args, **argv) -> HttpResponse:
    """
    Custom 404 error handler.
    """
    return render(request, "404.html", status=404)
