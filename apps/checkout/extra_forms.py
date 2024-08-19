from django import forms
from django.conf import settings
from oscar.core.loading import get_model

Source = get_model("payment", "Source")

class PayNowDetailsForm(forms.ModelForm):
    reference = forms.CharField(required=False, label="<strong>Payment reference</strong>")
    payment_proof = forms.ImageField(required=True, label="Payment confirmation (screenshot)")

    reference.widget.attrs.update({"readonly": True, "class": "font-weight-bold"})

    def __init__(self, *args, **kwargs):
        basket_id =  kwargs.pop("basket_id", None)
        super().__init__(*args, **kwargs)

        if basket_id:
            basket_id = settings.BASE_ORDER_NUMBER + basket_id
            self.initial['reference'] = f"MER{basket_id}"

    class Meta:
        model = Source
        fields = ("reference", "payment_proof")