from django.apps import AppConfig
from oscar.core.application import OscarDashboardConfig


class RefundDashboardConfig(OscarDashboardConfig):
    name = "apps.dashboard.refund"
    label = "dashboard_refund"
    namespace = "dashboard-refund"
    verbose_name = "Refund Dashboard"
