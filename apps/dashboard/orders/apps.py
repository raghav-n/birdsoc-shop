import oscar.apps.dashboard.orders.apps as apps
from django.urls import path

from apps.dashboard.orders.views import (
    OrderLookupView,
    OrderCollectionView,
    OrderSummaryView,
)


class OrdersDashboardConfig(apps.OrdersDashboardConfig):
    name = "apps.dashboard.orders"

    def get_urls(self):
        new_urls = [
            path(
                "lookup/",
                OrderLookupView.as_view(),
                name="order-lookup",
            ),
            path(
                "collect/",
                OrderCollectionView.as_view(),
                name="order-collection",
            ),
            path("summary/", OrderSummaryView.as_view(), name="order-summary"),
        ]

        return self.post_process_urls(new_urls) + super().get_urls()
