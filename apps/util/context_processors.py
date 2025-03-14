import hashlib
import uuid

from django.conf import settings
from oscar.core.loading import get_model


def get_valid_shipping_method_ids():
    DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
    methods = DynamicShippingMethod._default_manager.filter(active=True).values_list(
        "code", flat=True
    )
    # convert each method to a UUID
    return [str(uuid.UUID(hashlib.md5(m.encode("UTF-8")).hexdigest())) for m in methods]


def whitelist(request):
    valid_shipping_methods = get_valid_shipping_method_ids()
    is_staff = request.user.is_staff
    whitelist_user = (
        hasattr(request.user, "email")
        and request.user.email in settings.WHITELIST_USERS
    )
    whitelist_method_id_session = (
        request.session.get("method_id") in valid_shipping_methods
    )
    whitelist_method_id_request = request.GET.get("method_id") in valid_shipping_methods

    reasons = []

    if is_staff:
        reasons.append("is_staff")

    if whitelist_user:
        reasons.append("whitelist_user")

    if whitelist_method_id_session:
        reasons.append("whitelist_method_id_session")

    if whitelist_method_id_request:
        reasons.append("whitelist_method_id_request")

    result = {
        "whitelist": len(reasons) > 0,
        "reasons": ", ".join(reasons),
    }

    return result
