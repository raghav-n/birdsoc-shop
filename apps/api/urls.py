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
from apps.api.views.event_registrations import (
    EventRegistrationDetailView,
    EventRegistrationProofUploadView,
)
from apps.api.views.auth import (
    RegisterView,
    MeView,
    EmailTokenObtainPairView,
    PasswordResetView,
    PasswordResetConfirmView,
)
from apps.api.views.checkout import (
    PayNowProofUploadView,
    PlaceOrderView,
    CheckoutEmailView,
    CheckoutAddressView,
)
from apps.api.views.payments import PayNowGmailCheckView


router = routers.DefaultRouter(trailing_slash=False)
router.register(r"products", ProductViewSet, basename="products")
router.register(r"categories", CategoryViewSet, basename="categories")
router.register(r"orders", OrdersViewSet, basename="orders")
router.register(r"events", EventsViewSet, basename="events")


urlpatterns = [
    # Auth
    path("auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("users/me/", MeView.as_view(), name="users-me"),
    path("auth/password/reset/", PasswordResetView.as_view(), name="password-reset"),
    path("auth/password/reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),

    # Misc
    path("health", HealthView.as_view(), name="health"),
    path("config", ConfigView.as_view(), name="config"),
    path("shipping/methods", ShippingMethodsView.as_view(), name="shipping-methods"),
    path("checkout/shipping-methods", ShippingMethodsView.as_view(), name="checkout-shipping-methods"),
    path("checkout/payment/paynow-proof", PayNowProofUploadView.as_view(), name="checkout-paynow-proof"),
    path("checkout/payment/paynow-email-check", PayNowGmailCheckView.as_view(), name="checkout-paynow-email-check"),
    path("checkout/place-order", PlaceOrderView.as_view(), name="checkout-place-order"),
    path("checkout/email", CheckoutEmailView.as_view(), name="checkout-email"),
    path("checkout/address", CheckoutAddressView.as_view(), name="checkout-address"),

    # Basket
    path("baskets", BasketCreateView.as_view(), name="basket-create"),
    path("baskets/current", BasketCurrentView.as_view(), name="basket-current"),
    path("baskets/<int:basket_id>/lines", BasketLinesView.as_view(), name="basket-lines"),
    path(
        "baskets/<int:basket_id>/lines/<int:line_id>",
        BasketLineDetailView.as_view(),
        name="basket-line-detail",
    ),
    path("baskets/<int:basket_id>/apply-voucher", BasketApplyVoucherView.as_view(), name="basket-apply-voucher"),
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
    path(
        "event-registrations/<int:reg_id>/payment/paynow-proof",
        EventRegistrationProofUploadView.as_view(),
        name="event-registration-paynow-proof",
    ),

    # Routers
    path("", include(router.urls)),
]
