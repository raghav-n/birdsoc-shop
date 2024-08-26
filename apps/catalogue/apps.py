import oscar.apps.catalogue.apps as apps
from django.urls import path


class CatalogueConfig(apps.CatalogueConfig):
    name = "apps.catalogue"

    def get_home_url_pattern(self):
        from apps.catalogue.views import HomeView

        return path("", HomeView.as_view(), name="home")
