from oscar.apps.checkout.views import ShippingAddressView as CoreShippingAddressView
from oscar.apps.checkout.views import ShippingMethodView as CoreShippingMethodView
from oscar.apps.checkout.views import PaymentMethodView as CorePaymentMethodView
from oscar.apps.checkout.views import PaymentDetailsView as CorePaymentDetailsView
from oscar.apps.checkout.views import ThankYouView as CoreThankYouView
from django.conf import settings
from oscar.core.loading import get_model

from apps.checkout.extra_forms import PayNowDetailsForm
from apps.shipping import methods

Source = get_model("payment", "Source")
SourceType = get_model("payment", "SourceType")

if settings.GLOBAL_SELF_COLLECTION_REQUIRED:
    PAYMENT_VIEW_PRECONDITIONS = [
        "check_basket_is_not_empty",
        "check_basket_is_valid",
        "check_user_email_is_captured",
    ]
else:
    PAYMENT_VIEW_PRECONDITIONS = [
        "check_basket_is_not_empty",
        "check_basket_is_valid",
        "check_user_email_is_captured",
        "check_shipping_data_is_captured",
    ]


class ShippingAddressView(CoreShippingAddressView):
    skip_conditions = [
        "skip_unless_basket_requires_shipping",
        "skip_if_global_self_collection",
    ]


class ShippingMethodView(CoreShippingMethodView):
    def get(self, request, *args, **kwargs):
        if settings.GLOBAL_SELF_COLLECTION_REQUIRED:
            self.checkout_session.use_shipping_method(methods.SelfCollectHW2024().code)
            return self.get_success_response()
        super().get(request, *args, **kwargs)


class PaymentMethodView(CorePaymentMethodView):
    pre_conditions = PAYMENT_VIEW_PRECONDITIONS


class PaymentDetailsView(CorePaymentDetailsView):
    pre_conditions = PAYMENT_VIEW_PRECONDITIONS
    template_name = "oscar/checkout/payment_details.html"

    def post(self, request, *args, **kwargs):
        if settings.GLOBAL_PAYNOW_REQUIRED:
            # enable post request from non-preview (because there's no preview)
            form = PayNowDetailsForm(
                request.POST, request.FILES, basket_id=request.basket.id
            )
            if form.is_valid():
                order_payment_source = form.save(commit=False)
                source_type, _created = SourceType.objects.get_or_create(name="PayNow")
                order_payment_source.amount_debited = request.basket.total_incl_tax
                order_payment_source.source_type = source_type
                self.checkout_session.set_order_paynow_payment_id(
                    order_payment_source.id
                )
                self.add_payment_source(order_payment_source)
                self.add_payment_event(
                    "paynow-processing",
                    request.basket.total_incl_tax,
                    reference=order_payment_source.reference,
                )
                return self.handle_place_order_submission(request)
            else:
                return self.get(request, *args, form=form, **kwargs)

        return self.render_preview(request)

    def get_context_data(self, form=None, **kwargs):
        context = super().get_context_data(**kwargs)

        if settings.GLOBAL_PAYNOW_REQUIRED:
            if not self.preview:
                form = PayNowDetailsForm(basket_id=self.request.basket.id)
                context["paynow_form"] = form
                context["reference_id"] = form.initial["reference"]
                if form:
                    context["paynow_form"] = form

        return context

    def get(self, request, *args, **kwargs):
        if settings.GLOBAL_PAYNOW_REQUIRED:
            if self.preview:  # skip preview!
                return self.handle_place_order_submission(request)

        return super().get(request, *args, **kwargs)


class ThankYouView(CoreThankYouView):
    def get_context_data(self, *args, **kwargs):
        context = super().get_context_data(*args, **kwargs)
        context["shipping_method"] = context["order"].get_shipping_method()
        return context
