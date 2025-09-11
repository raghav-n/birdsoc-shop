from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class FormDashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard.form"
    label = "form_dashboard"
    verbose_name = _("Form Dashboard")

