from oscar.apps.shipping import repository
from . import methods as shipping_methods


class Repository(repository.Repository):
    methods = (shipping_methods.SelfCollectHW2024Round2(),)
    archived_methods = (shipping_methods.SelfCollectHW2024(),)
