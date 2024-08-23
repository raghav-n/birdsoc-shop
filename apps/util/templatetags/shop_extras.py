from django import template
from django.conf import settings
from oscar.core.loading import get_class

register = template.Library()

Repository = get_class("shipping.repository", "Repository")


# settings value
@register.filter
def settings_value(value):
    return getattr(settings, value, "")


@register.filter
def shipping_method_description(shipping_method):
    methods = Repository().get_available_shipping_methods(basket=None)
    for method in methods:
        if method.name == shipping_method:
            return method.description


@register.filter
def shipping_method_email_description(shipping_method):
    methods = Repository().get_available_shipping_methods(basket=None)
    for method in methods:
        if method.name == shipping_method:
            return method.email_description
