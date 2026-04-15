import oscar.apps.dashboard.orders.apps as apps
from django.urls import path


class OrdersDashboardConfig(apps.OrdersDashboardConfig):
    name = "apps.dashboard.orders"

    def get_urls(self):
        from apps.dashboard.orders.views import (
            OrderCollectionView,
            OrderScanResultView,
            OrderSummaryView,
            OnsitePurchaseView,
            VoucherCheckView,
            SiteOffersView,
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
                "scan/result/",
                OrderScanResultView.as_view(),
                name="order-lookup",
            ),
            path(
                "collect/",
                OrderCollectionView.as_view(),
                name="order-collection",
            ),
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
            path(
                "scan/result/<str:number>/",
                OrderScanResultView.as_view(),
                name="order-scan-result",
            ),
            path("summary/", OrderSummaryView.as_view(), name="order-summary"),
            path(
                "onsite-purchase/", OnsitePurchaseView.as_view(), name="onsite-purchase"
            ),
            path("voucher-check/", VoucherCheckView.as_view(), name="voucher-check"),
            path("site-offers/", SiteOffersView.as_view(), name="site-offers"),
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
        ]

        return self.post_process_urls(new_urls) + super().get_urls()
