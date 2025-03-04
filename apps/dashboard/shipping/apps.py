import oscar.apps.dashboard.shipping.apps as apps

from django.urls import path

from apps.dashboard.shipping.views import (
    DynamicShippingMethodListView,
    DynamicShippingMethodCreateView,
    DynamicShippingMethodUpdateView,
    DynamicShippingMethodDeleteView,
)


class ShippingDashboardConfig(apps.ShippingDashboardConfig):
    name = "apps.dashboard.shipping"

    def get_urls(self):
        new_urls = [
            path(
                "shipping-methods/",
                DynamicShippingMethodListView.as_view(),
                name="dynamic-shipping-method-list",
            ),
            path(
                "shipping-methods/create/",
                DynamicShippingMethodCreateView.as_view(),
                name="dynamic-shipping-method-create",
            ),
            path(
                "shipping-methods/edit/<int:pk>/",
                DynamicShippingMethodUpdateView.as_view(),
                name="dynamic-shipping-method-edit",
            ),
            path(
                "shipping-methods/delete/<int:pk>/",
                DynamicShippingMethodDeleteView.as_view(),
                name="dynamic-shipping-method-delete",
            ),
        ]

        return self.post_process_urls(new_urls) + super().get_urls()
