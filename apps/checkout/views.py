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
    def _get_shipping_method(self, self_collection=False):
        DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
        return DynamicShippingMethod._default_manager.filter(
            active=True, is_self_collect=self_collection, available_to_public=True
        ).first()

    def get(self, request, *args, **kwargs):
        # assume for public access, only one self-collection and one delivery method available at once

        self.checkout_session.use_shipping_method(
            self._get_shipping_method(
                self_collection=settings.GLOBAL_SELF_COLLECTION_REQUIRED
            ).code
        )

        return self.get_success_response()


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
                donation_amount = form.cleaned_data.get("donation")

                if donation_amount is None:
                    donation_amount = 0
                else:
                    donation_amount = int(donation_amount)

                total_with_donation = request.basket.total_incl_tax + donation_amount

                order_payment_source.amount_debited = total_with_donation
                order_payment_source.source_type = source_type

                self.add_payment_source(order_payment_source)
                self.add_payment_event(
                    "paynow-processing",
                    total_with_donation,
                    reference=order_payment_source.reference,
                )
                return self.handle_place_order_submission(
                    request, donation_amount=donation_amount
                )
            else:
                return self.get(request, *args, form=form, **kwargs)

        return self.render_preview(request)

    def handle_place_order_submission(self, request, donation_amount: int = None):
        submission = self.build_submission()

        if donation_amount is None:
            donation_amount = 0

        if isinstance(submission.get("order_kwargs"), dict):
            submission["order_kwargs"]["donation_amount"] = donation_amount
        else:
            submission["order_kwargs"] = {"donation_amount": donation_amount}

        return self.submit(**submission)

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
