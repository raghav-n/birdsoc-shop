from crispy_forms.bootstrap import PrependedText
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Layout, Field, Submit
from django import forms
from django.conf import settings
from django.utils.safestring import mark_safe
from oscar.core.loading import get_model

Source = get_model("payment", "Source")


class PayNowDetailsForm(forms.ModelForm):
    donation = forms.IntegerField(
        required=False, label=mark_safe("<strong>Add a donation (optional)</strong>")
    )
    reference = forms.CharField(
        required=False, label=mark_safe("<strong>Payment reference</strong>"),
        help_text="<strong class='text-warning'>Please enter this reference number when making your payment, so that your payment can be easily traced.</strong>"
    )
    payment_proof = forms.ImageField(
        required=True,
        label=mark_safe("<strong>Payment confirmation (screenshot)</strong>"),
    )

    reference.widget.attrs.update({"readonly": True, "class": "font-weight-bold"})
    donation.widget.attrs.update({"min": "0"})

    def __init__(self, *args, **kwargs):
        basket_id = kwargs.pop("basket_id", None)
        super().__init__(*args, **kwargs)

        self.helper = FormHelper()
        self.helper.layout = Layout(
            PrependedText("donation", "$", placeholder="amount", css_class="bg-white"),
            Field("reference"),
            Field("payment_proof"),
            Submit("submit", "Complete order", css_class="w-100"),
        )
        self.helper.form_class = "form-horizontal"
        self.helper.label_class = "col-lg-4"
        self.helper.field_class = "col-lg-8"

        if basket_id:
            basket_id = settings.BASE_ORDER_NUMBER + basket_id
            self.initial["reference"] = f"{settings.ORDER_PREFIX}{basket_id}"

    class Meta:
        model = Source
        fields = ("donation", "reference", "payment_proof")
