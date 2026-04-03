from django import forms
from oscar.apps.dashboard.catalogue.forms import ProductForm as CoreProductForm
from oscar.apps.dashboard.catalogue.forms import ProductImageForm as CoreProductImageForm
from oscar.apps.dashboard.catalogue.forms import StockRecordForm as CoreStockRecordForm


class StockRecordForm(CoreStockRecordForm):
    class Meta(CoreStockRecordForm.Meta):
        fields = CoreStockRecordForm.Meta.fields + ["cost_price"]


class ProductForm(CoreProductForm):
    upc = forms.CharField(required=False)


class ProductImageForm(CoreProductImageForm):
    focal_point_x = forms.IntegerField(
        min_value=0, max_value=100, initial=50,
        widget=forms.HiddenInput(),
    )
    focal_point_y = forms.IntegerField(
        min_value=0, max_value=100, initial=50,
        widget=forms.HiddenInput(),
    )

    class Meta(CoreProductImageForm.Meta):
        fields = CoreProductImageForm.Meta.fields + ["focal_point_x", "focal_point_y"]
