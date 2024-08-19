from django.conf import settings
from django.urls import reverse
from oscar.apps.checkout.session import *
from oscar.apps.checkout.session import CheckoutSessionMixin as CoreCheckoutSessionMixin
from oscar.apps.checkout import exceptions

class CheckoutSessionMixin(CoreCheckoutSessionMixin):
    def skip_if_global_self_collection(self, request):
        if settings.GLOBAL_SELF_COLLECTION_REQUIRED:
            raise exceptions.PassedSkipCondition(
                url=reverse("checkout:shipping-method")
            )