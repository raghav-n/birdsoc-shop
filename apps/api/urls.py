from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import TokenRefreshView

from apps.api.views.catalogue import ProductViewSet, CategoryViewSet
from apps.api.views.misc import HealthView, ConfigView, ShippingMethodsView
from apps.api.views.basket import (
    BasketCreateView,
    BasketCurrentView,
    BasketLinesView,
    BasketLineDetailView,
    BasketApplyVoucherView,
    BasketMergeView,
)
from apps.api.views.orders import OrdersViewSet
from apps.api.views.refunds import RefundRequestCreateView, RefundRequestDetailView
from apps.api.views.events import EventsViewSet
from apps.api.views.registration_status import RegistrationStatusView
from apps.api.views.event_registrations import (
    EventRegistrationDetailView,
    EventRegistrationProofUploadView,
    EventRegistrationGroupDetailView,
    EventRegistrationGroupProofUploadView,
    EventRegistrationPayNowEmailCheckView,
    EventRegistrationGroupPayNowEmailCheckView,
)
from apps.api.views.auth import (
    RegisterView,
    MeView,
    EmailTokenObtainPairView,
    PasswordResetView,
    PasswordResetConfirmView,
    SessionTokenView,
)
from apps.api.views.contact import ContactFormAPIView
from apps.api.views.faq import FAQListView
from apps.api.views.checkout import (
    PayNowProofUploadView,
    PlaceOrderView,
    CheckoutEmailView,
    CheckoutAddressView,
    SavePendingCheckoutView,
)
from apps.api.views.payments import PayNowGmailCheckView, PayNowGmailTestEmailView
from apps.api.views.forms import FormSubmissionView, FormSchemaView
from apps.api.views.banners import BannerListView, TextBannerView
from apps.api.views.analytics import AnalyticsDashboardView
from apps.api.views.donations import DonationCreateView
from apps.api.views.onsite import OnsiteCalculateView, OnsitePendingView, OnsiteOrderView
from apps.api.views.order_lookup import OrderSearchView, OrderCollectView
from apps.api.views.console_events import (
    ConsoleEventsViewSet,
    ConsoleVerifyRegistrationView,
    ConsoleVerifyGroupView,
    ConsoleRegistrationToggleView,
    ConsoleEventTagsView,
    EventImageView,
    GuideEventView,
    GuideToggleAttendanceView,
    GuideUpdateNotesView,
)


router = routers.DefaultRouter(trailing_slash=False)
router.register(r"products", ProductViewSet, basename="products")
router.register(r"categories", CategoryViewSet, basename="categories")
router.register(r"orders", OrdersViewSet, basename="orders")
router.register(r"events", EventsViewSet, basename="events")
router.register(r"console/events", ConsoleEventsViewSet, basename="console-events")


urlpatterns = [
    # Auth
    path("auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/session-token/", SessionTokenView.as_view(), name="auth-session-token"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("users/me/", MeView.as_view(), name="users-me"),
    path("auth/password/reset/", PasswordResetView.as_view(), name="password-reset"),
    path(
        "auth/password/reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    # Misc
    path("health", HealthView.as_view(), name="health"),
    path("config", ConfigView.as_view(), name="config"),
    path("contact", ContactFormAPIView.as_view(), name="contact"),
    path("faq", FAQListView.as_view(), name="faq-list"),
    path("banners", BannerListView.as_view(), name="banner-list"),
    path("banners/text", TextBannerView.as_view(), name="banner-text"),
    path("analytics/dashboard", AnalyticsDashboardView.as_view(), name="analytics-dashboard"),
    path("onsite/calculate", OnsiteCalculateView.as_view(), name="onsite-calculate"),
    path("orders/search", OrderSearchView.as_view(), name="orders-search"),
    path("orders/<str:number>/collect", OrderCollectView.as_view(), name="orders-collect"),
    path("onsite/pending", OnsitePendingView.as_view(), name="onsite-pending"),
    path("onsite/order", OnsiteOrderView.as_view(), name="onsite-order"),
    path("donations", DonationCreateView.as_view(), name="donation-create"),
    path("shipping/methods", ShippingMethodsView.as_view(), name="shipping-methods"),
    path(
        "checkout/payment/paynow-proof",
        PayNowProofUploadView.as_view(),
        name="checkout-paynow-proof",
    ),
    path(
        "checkout/payment/paynow-email-check",
        PayNowGmailCheckView.as_view(),
        name="checkout-paynow-email-check",
    ),
    path(
        "checkout/payment/paynow-email-test",
        PayNowGmailTestEmailView.as_view(),
        name="checkout-paynow-email-test",
    ),
    path("checkout/place-order", PlaceOrderView.as_view(), name="checkout-place-order"),
    path(
        "checkout/pending",
        SavePendingCheckoutView.as_view(),
        name="checkout-pending",
    ),
    path("checkout/email", CheckoutEmailView.as_view(), name="checkout-email"),
    path("checkout/address", CheckoutAddressView.as_view(), name="checkout-address"),
    # Forms: submission only
    path("forms/<slug:slug>/submit", FormSubmissionView.as_view(), name="form-submit"),
    # Forms: schema for rendering on frontend
    path("forms/<slug:slug>/schema", FormSchemaView.as_view(), name="form-schema"),
    # Basket
    path("baskets", BasketCreateView.as_view(), name="basket-create"),
    path("baskets/current", BasketCurrentView.as_view(), name="basket-current"),
    path(
        "baskets/<int:basket_id>/lines", BasketLinesView.as_view(), name="basket-lines"
    ),
    path(
        "baskets/<int:basket_id>/lines/<int:line_id>",
        BasketLineDetailView.as_view(),
        name="basket-line-detail",
    ),
    path(
        "baskets/<int:basket_id>/apply-voucher",
        BasketApplyVoucherView.as_view(),
        name="basket-apply-voucher",
    ),
    path("baskets/merge", BasketMergeView.as_view(), name="basket-merge"),
    # Refunds
    path("refunds", RefundRequestCreateView.as_view(), name="refunds-create"),
    path("refunds/<int:pk>", RefundRequestDetailView.as_view(), name="refunds-detail"),
    # Event registrations (paid events)
    path(
        "event-registrations/<int:reg_id>",
        EventRegistrationDetailView.as_view(),
        name="event-registration-detail",
    ),
    # Events: global registration status
    path(
        "events/registration-status",
        RegistrationStatusView.as_view(),
        name="events-registration-status",
    ),
    path(
        "event-registrations/<int:reg_id>/payment/paynow-proof",
        EventRegistrationProofUploadView.as_view(),
        name="event-registration-paynow-proof",
    ),
    path(
        "event-registration-groups/<int:group_id>",
        EventRegistrationGroupDetailView.as_view(),
        name="event-registration-group-detail",
    ),
    path(
        "event-registration-groups/<int:group_id>/payment/paynow-proof",
        EventRegistrationGroupProofUploadView.as_view(),
        name="event-registration-group-paynow-proof",
    ),
    path(
        "event-registrations/<int:reg_id>/payment/paynow-email-check",
        EventRegistrationPayNowEmailCheckView.as_view(),
        name="event-registration-paynow-email-check",
    ),
    path(
        "event-registration-groups/<int:group_id>/payment/paynow-email-check",
        EventRegistrationGroupPayNowEmailCheckView.as_view(),
        name="event-registration-group-paynow-email-check",
    ),
    # Console: event management
    path(
        "console/event-registrations/<int:reg_id>/verify",
        ConsoleVerifyRegistrationView.as_view(),
        name="console-verify-registration",
    ),
    path(
        "console/event-registration-groups/<int:group_id>/verify",
        ConsoleVerifyGroupView.as_view(),
        name="console-verify-group",
    ),
    path(
        "console/registration-toggle",
        ConsoleRegistrationToggleView.as_view(),
        name="console-registration-toggle",
    ),
    path(
        "console/event-images",
        EventImageView.as_view(),
        name="console-event-images",
    ),
    path(
        "console/event-tags",
        ConsoleEventTagsView.as_view(),
        name="console-event-tags",
    ),
    # Guide access (no auth — token-gated)
    path(
        "guide/<uuid:token>/event",
        GuideEventView.as_view(),
        name="guide-event",
    ),
    path(
        "guide/<uuid:token>/participants/<int:ep_id>/toggle-attendance",
        GuideToggleAttendanceView.as_view(),
        name="guide-toggle-attendance",
    ),
    path(
        "guide/<uuid:token>/participants/<int:ep_id>",
        GuideUpdateNotesView.as_view(),
        name="guide-participant",
    ),
    # Routers
    path("", include(router.urls)),
]
