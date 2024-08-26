import oscar.apps.customer.apps as apps
from django.urls import path
from oscar.core.loading import get_class


class CustomerConfig(apps.CustomerConfig):
    name = "apps.customer"

    def ready(self):
        super().ready()
        self.login_only_view = get_class("customer.views", "LoginOnlyAccountAuthView")

    def get_urls(self):
        current_urls = super().get_urls()

        to_remove = [
            "email-list",
            "email-detail",
            "alerts-list",
            "alert-create",
            "alerts-confirm",
            "alerts-cancel-by-key",
            "alerts-cancel-by-pk",
            "notifications-inbox",
            "notifications-archive",
            "notifications-update",
            "notifications-detail",
            "address-list",
            "address-create",
            "address-detail",
            "address-delete",
            "address-change-status",
        ]

        urls = [url for url in current_urls if url.name not in to_remove]
        urls.append(
            path("login-only/", self.login_only_view.as_view(), name="login-only")
        )

        return urls
