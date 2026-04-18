from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class DonationDashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard.donation"
    label = "donation_dashboard"
    verbose_name = _("Donation Dashboard")
