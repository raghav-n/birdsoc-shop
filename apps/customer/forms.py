from django import forms
from oscar.apps.customer.forms import EmailUserCreationForm as CoreEmailUserCreationForm
from oscar.apps.customer.forms import ProfileForm as CoreProfileForm
from oscar.core.compat import get_user_model

User = get_user_model()


class EmailUserCreationForm(CoreEmailUserCreationForm):
    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)

    class Meta:
        model = User
        fields = ('email', 'first_name', 'last_name', )

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])

        if commit:
            user.save()

        return user

class ProfileForm(CoreProfileForm):
    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)