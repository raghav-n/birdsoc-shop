import oscar.apps.dashboard.catalogue.apps as apps
from django.urls import path


class CatalogueDashboardConfig(apps.CatalogueDashboardConfig):
    name = "apps.dashboard.catalogue"

    def ready(self):
        super().ready()
        from apps.dashboard.catalogue.views import ProductCreateUpdateView, CostPriceListView
        self.product_createupdate_view = ProductCreateUpdateView
        self.cost_price_list_view = CostPriceListView

    def get_urls(self):
        urls = super().get_urls()
        urls += [
            path(
                "cost-prices/",
                self.cost_price_list_view.as_view(),
                name="catalogue-cost-prices",
            ),
        ]
        return urls
