from crispy_forms.helper import FormHelper
from crispy_forms.layout import Layout, Field, Submit
from django import forms
from django.conf import settings
from django.core.mail import EmailMessage
from django.forms import ModelForm
from django.utils.safestring import mark_safe
from django_contact_form.forms import ContactForm as BaseContactForm

from apps.customer.models import EmailAlert


class ContactForm(BaseContactForm):
    pdpa_agreement = forms.BooleanField(
        label=mark_safe(
            "I have read and agree to the <a href='https://birdsociety.sg/data-protection-notice/'>data protection notice</a>."
        )
    )
    subject_template_name = "django_contact_form/emails/contact_form_subject.txt"
    template_name = "django_contact_form/emails/contact_form.html"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.layout = Layout(
            Field("name"),
            Field("email"),
            Field("body"),
            Field("pdpa_agreement"),
            Submit("submit", "Submit"),
        )

    def get_message_dict(self):
        message_dict = super().get_message_dict()
        message_dict["to"] = message_dict.pop("recipient_list")
        message_dict["body"] = message_dict.pop("message")
        return message_dict

    def save(self, fail_silently=False):
        """
        If the form has data and is valid, construct and send the email.

        By default, this is done by obtaining the parts of the email from
        :meth:`get_message_dict` and passing the result to Django's
        :func:`~django.core.mail.send_mail` function.

        """
        msg = EmailMessage(
            **self.get_message_dict(), reply_to=[settings.REPLY_TO_EMAIL]
        )
        msg.content_subtype = "html"
        msg.send()


class EmailAlertForm(ModelForm):
    class Meta:
        model = EmailAlert
        fields = ("email",)
