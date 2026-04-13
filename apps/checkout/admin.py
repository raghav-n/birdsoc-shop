from django.contrib import admin
from apps.checkout.models import PendingCheckout, UnmatchedPayment


@admin.register(PendingCheckout)
class PendingCheckoutAdmin(admin.ModelAdmin):
    list_display = ("reference", "basket_id", "email", "donation", "created_at")
    list_filter = ("created_at",)
    search_fields = ("reference", "email")
    readonly_fields = ("created_at", "basket_snapshot")


@admin.register(UnmatchedPayment)
class UnmatchedPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "amount",
        "occurrence_count",
        "first_seen_at",
        "last_seen_at",
        "notification_sent_at",
    )
    list_filter = ("notification_sent_at", "first_seen_at", "last_seen_at")
    search_fields = ("order_number",)
    readonly_fields = (
        "occurrence_count",
        "first_seen_at",
        "last_seen_at",
        "notification_sent_at",
    )
