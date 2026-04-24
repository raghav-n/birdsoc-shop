from django import forms
from apps.home.models import ShopConfig


class ShopConfigForm(forms.ModelForm):
    class Meta:
        model = ShopConfig
        fields = ["shop_open", "shop_open_public", "close_datetime"]
        widgets = {
            "close_datetime": forms.DateTimeInput(attrs={"type": "datetime-local", "class": "form-control"}, format="%Y-%m-%dT%H:%M"),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["close_datetime"].input_formats = ["%Y-%m-%dT%H:%M"]
