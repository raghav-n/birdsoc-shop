from django import forms

from apps.faq.models import FAQItem


class FAQItemForm(forms.ModelForm):
    class Meta:
        model = FAQItem
        fields = ["question", "answer", "position", "is_active"]
        widgets = {
            "answer": forms.Textarea(attrs={"rows": 10}),
        }
