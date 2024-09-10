import oscar.apps.dashboard.orders.apps as apps
from django.urls import path

from apps.dashboard.orders.views import OrderLookupView, OrderCollectionView


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
            )
        ]

        return self.post_process_urls(new_urls) + super().get_urls()
