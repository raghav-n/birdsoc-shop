from oscar.apps.shipping import repository
from . import methods as shipping_methods

from oscar.core.loading import get_model


class Repository(repository.Repository):
    # methods = (shipping_methods.SelfCollectHW2024Round2(),)
    archived_methods = (shipping_methods.SelfCollectHW2024(),)

    def get_shipping_methods(self, basket=None, shipping_addr=None, **kwargs):
        DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
        return DynamicShippingMethod.objects.filter(active=True)

    def get_available_shipping_methods(self, basket, shipping_addr=None, **kwargs):
        return self.get_shipping_methods()
