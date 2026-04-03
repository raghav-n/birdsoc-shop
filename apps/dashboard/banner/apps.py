from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class BannerDashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard.banner"
    label = "banner_dashboard"
    verbose_name = _("Banner Dashboard")
