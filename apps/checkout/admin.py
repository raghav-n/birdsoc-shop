from django.contrib import admin
from apps.checkout.models import PendingCheckout


@admin.register(PendingCheckout)
class PendingCheckoutAdmin(admin.ModelAdmin):
    list_display = ("reference", "basket_id", "email", "donation", "created_at")
    list_filter = ("created_at",)
    search_fields = ("reference", "email")
    readonly_fields = ("created_at",)
