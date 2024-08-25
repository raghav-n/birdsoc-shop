from crispy_forms.helper import FormHelper
from crispy_forms.layout import Layout, Field, Submit
from django import forms
from django.utils.safestring import mark_safe
from oscar.apps.customer.forms import EmailUserCreationForm as CoreEmailUserCreationForm
from oscar.apps.customer.forms import ProfileForm as CoreProfileForm
from oscar.core.compat import get_user_model

User = get_user_model()


class EmailUserCreationForm(CoreEmailUserCreationForm):
    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)
    pdpa_agreement = forms.BooleanField(
        label=mark_safe(
            "I have read and agree to the <a href='https://birdsociety.sg/data-protection-notice/'>data protection notice</a>."
        )
    )

    class Meta:
        model = User
        fields = ("email", "first_name", "last_name", "pdpa_agreement")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.layout = Layout(
            Field("first_name"),
            Field("last_name"),
            Field("email"),
            Field("password1"),
            Field("password2"),
            Field("pdpa_agreement"),
            Submit("registration_submit", "Register"),
        )

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])

        if commit:
            user.save()

        return user


class ProfileForm(CoreProfileForm):
    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)
