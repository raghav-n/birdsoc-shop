from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class EventDashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard.event"
    label = "event_dashboard"
    verbose_name = _("Event Dashboard")
