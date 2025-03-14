from django.apps import AppConfig
from django.urls import path


class RefundConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.refund"
    verbose_name = "Refunds"

    def get_urls(self):
        from . import views

        urls = [
            path("", views.RefundRequestView.as_view(), name="request"),
            path("thanks/", views.RefundThanksView.as_view(), name="thanks"),
        ]
        return self.post_process_urls(urls)
