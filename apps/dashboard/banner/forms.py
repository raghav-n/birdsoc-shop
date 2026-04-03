from django import forms

from apps.banner.models import BannerImage, TextBanner


class BannerImageForm(forms.ModelForm):
    class Meta:
        model = BannerImage
        fields = ["image", "show_on_product", "show_on_event", "order"]


class TextBannerForm(forms.ModelForm):
    class Meta:
        model = TextBanner
        fields = ["text", "is_active"]
        widgets = {
            "text": forms.Textarea(attrs={"rows": 4}),
        }
