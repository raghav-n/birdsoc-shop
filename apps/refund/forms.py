from django import forms
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Submit, Layout, Div, Field
from .models import RefundRequest


class RefundRequestForm(forms.ModelForm):
    class Meta:
        model = RefundRequest
        fields = ["name", "email", "paynow_phone", "order_number", "amount", "reason"]
        widgets = {
            "reason": forms.Textarea(attrs={"rows": 5}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["name"].widget.attrs.update({"class": "form-control"})
        self.fields["email"].widget.attrs.update({"class": "form-control"})
        self.fields["paynow_phone"].widget.attrs.update({"class": "form-control"})
        self.fields["order_number"].widget.attrs.update({"class": "form-control"})
        self.fields["amount"].widget.attrs.update({"class": "form-control"})
        self.fields["reason"].widget.attrs.update({"class": "form-control"})

        self.fields["paynow_phone"].label = "PayNow phone number"
        self.fields["order_number"].label = "Order number (6 characters/digits)"
        self.fields["amount"].label = "Refund amount (SGD)"

        self.helper = FormHelper()
        self.helper.layout = Layout(
            Div(
                Field("name"),
                Field("email"),
                Field("paynow_phone"),
                Field("order_number"),
                Field("amount"),
                Field("reason"),
                Submit("submit", "Submit", css_class="btn btn-primary"),
            )
        )


class RefundApprovalForm(forms.ModelForm):
    class Meta:
        model = RefundRequest
        fields = ["status"]


class RefundDisbursementForm(forms.ModelForm):
    """Form for treasurer to mark refund as disbursed"""

    class Meta:
        model = RefundRequest
        fields = ["status", "refund_number"]
        widgets = {
            "status": forms.Select(
                choices=(
                    (RefundRequest.STATUS_APPROVED, "Approved"),
                    (RefundRequest.STATUS_DISBURSED, "Disbursed"),
                )
            )
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        self.fields["status"].label = "Update Status"
        self.fields[
            "status"
        ].help_text = "Mark as disbursed when you have sent the funds"
        self.fields["status"].widget.attrs.update({"class": "form-control"})

    def clean_status(self):
        status = self.cleaned_data["status"]
        if (
            status == RefundRequest.STATUS_DISBURSED
            and not self.instance.is_user_treasurer(self.user)
        ):
            raise forms.ValidationError(
                "Only the treasurer can mark refunds as disbursed."
            )
        return status
