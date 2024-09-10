from django.urls import reverse
from django.views.generic import RedirectView
from oscar.apps.catalogue.views import CatalogueView as CoreCatalogueView


class CatalogueView(RedirectView):
    def get_redirect_url(self):
        return reverse("home")


class HomeView(CoreCatalogueView):
    template_name = "oscar/catalogue/index.html"
