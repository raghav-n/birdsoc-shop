from django import forms
from .models import Form as DynamicForm, FormField


class DynamicFormForm(forms.ModelForm):
    class Meta:
        model = DynamicForm
        fields = [
            "name",
            "slug",
            "description",
            "is_active",
            "accept_submissions",
            "success_message",
        ]


class FormFieldForm(forms.ModelForm):
    class Meta:
        model = FormField
        fields = [
            "key",
            "label",
            "help_text",
            "field_type",
            "required",
            "display",
            "placeholder",
            "default_value",
            "choices",
            "order",
        ]
