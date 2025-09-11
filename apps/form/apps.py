from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class FormConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.form"
    label = "form"
    verbose_name = _("Forms")

