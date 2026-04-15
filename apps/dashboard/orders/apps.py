import oscar.apps.dashboard.orders.apps as apps
from django.urls import path


class OrdersDashboardConfig(apps.OrdersDashboardConfig):
    name = "apps.dashboard.orders"

    def ready(self):
        super().ready()
        from apps.dashboard.orders.views import OrderDetailView

        self.order_detail_view = OrderDetailView

    def get_urls(self):
        from apps.dashboard.orders.views import (
            OrderDetailView,
            OrderSummaryView,
            OnsitePurchaseView,
            OrderStatsView,
            SalesReportView,
            PendingCheckoutDashboardView,
            ResendConfirmationEmailView,
            OrderBulkEmailView,
            OrderBulkEmailCountView,
            OrderBulkEmailTestView,
        )

        new_urls = [
            path(
                "bulk-email/",
                OrderBulkEmailView.as_view(),
                name="order-bulk-email",
            ),
            path(
                "bulk-email/count/",
                OrderBulkEmailCountView.as_view(),
                name="order-bulk-email-count",
            ),
            path(
                "bulk-email/test/",
                OrderBulkEmailTestView.as_view(),
                name="order-bulk-email-test",
            ),
            path("summary/", OrderSummaryView.as_view(), name="order-summary"),
            path(
                "onsite-purchase/", OnsitePurchaseView.as_view(), name="onsite-purchase"
            ),
            path("statistics/", OrderStatsView.as_view(), name="order-statistics"),
            path("sales-report/", SalesReportView.as_view(), name="sales-report"),
            path(
                "pending-checkouts/",
                PendingCheckoutDashboardView.as_view(),
                name="pending-checkouts",
            ),
            path(
                "<str:number>/resend-confirmation/",
                ResendConfirmationEmailView.as_view(),
                name="order-resend-confirmation",
            ),
            path(
                "<str:number>/",
                OrderDetailView.as_view(),
                name="order-detail",
            ),
        ]

        return self.post_process_urls(new_urls) + super().get_urls()
