from django import forms
from oscar.apps.dashboard.catalogue.forms import ProductForm as CoreProductForm


class ProductForm(CoreProductForm):
    upc = forms.CharField(required=False)
