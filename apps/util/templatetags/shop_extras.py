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
    """
    Return the selected shipping method instance from this checkout session

    The shipping address is passed as we need to check that the method
    stored in the session is still valid for the shipping address.
    """
    methods = Repository().get_available_shipping_methods(basket=None)
    for method in methods:
        if method.name == shipping_method:
            return method.description
