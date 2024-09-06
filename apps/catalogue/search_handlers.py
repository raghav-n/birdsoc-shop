from oscar.apps.catalogue.search_handlers import (
    SimpleProductSearchHandler as CoreSimpleProductSearchHandler,
)


class SimpleProductSearchHandler(CoreSimpleProductSearchHandler):
    def get_queryset(self):
        return super().get_queryset().order_by("id")
