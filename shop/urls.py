"""
URL configuration for shop project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from apps.util.views import verify_payment, verify_event_payment
from django.apps import apps
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django_contact_form.views import ContactFormView

from apps.util.forms import ContactForm
from . import views

handler404 = "apps.util.views.handler404"
handler500 = "apps.util.views.handler500"

urlpatterns = [
    path("dashboard/login/", views.login, name="dashboard_login"),
    path("dashboard/logout/", views.logout, name="dashboard_logout"),
    path("dashboard/callback/", views.callback, name="dashboard_callback"),
    path("i18n/", include("django.conf.urls.i18n")),
    # The Django admin is not officially supported; expect breakage.
    # Nonetheless, it's often useful for debugging.
    path("admin/", admin.site.urls),
    path("", include(apps.get_app_config("home").urls[0])),
    apps.get_app_config("catalogue").get_home_url_pattern(),
    path(
        "dashboard/refund/",
        include("apps.dashboard.refund.urls", namespace="dashboard-refund"),
    ),
    path(
        "dashboard/event/",
        include("apps.dashboard.event.urls", namespace="dashboard-event"),
    ),
    path(
        "contact/",
        ContactFormView.as_view(form_class=ContactForm),
        name="django_contact_form",
    ),
    path(
        "contact/sent/",
        TemplateView.as_view(
            template_name="django_contact_form/contact_form_sent.html"
        ),
        name="django_contact_form_sent",
    ),
    path("faq/", TemplateView.as_view(template_name="oscar/faq.html"), name="faq"),
    path("promo/", TemplateView.as_view(template_name="promo.html"), name="promo"),
    path("refund/", include("apps.refund.urls", namespace="refund")),
    path("api/verify-payment/", verify_payment, name="verify-payment"),
    path(
        "api/verify-event-payment/", verify_event_payment, name="verify-event-payment"
    ),
    path("api/v1/", include("shop.api_urls")),
    # Include the event dashboard URLs with the namespace already defined in the urls.py
    path("dashboard/events/", include("apps.dashboard.event.urls")),
]

if not settings.SESSION_ENVIRONMENT_PRODUCTION:
    # Extra URL patterns for development
    urlpatterns.insert(0, path("__debug__/", include("debug_toolbar.urls")))
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
