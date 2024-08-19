from oscar.apps.catalogue.views import CatalogueView as CoreCatalogueView


class CatalogueView(CoreCatalogueView):
    template_name = "oscar/catalogue/browse-new.html"
