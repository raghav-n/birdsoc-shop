from django.conf import settings
from django.http import HttpResponseNotAllowed, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.views.generic import RedirectView
from oscar.apps.catalogue.views import CatalogueView as CoreCatalogueView

from apps.util.forms import EmailAlertForm
from apps.util.context_processors import whitelist


class CatalogueView(RedirectView):
    def get_redirect_url(self):
        return reverse("home")


class HomeView(CoreCatalogueView):
    template_name = "oscar/catalogue/index.html"
    template_name_closed = "shop-closed.html"

    def get(self, request, *args, **kwargs):
        if settings.SHOP_OPEN or whitelist(request):
            return super().get(request, *args, **kwargs)

        return render(request, self.template_name_closed)

    def post(self, request, *args, **kwargs):
        if settings.SHOP_OPEN:
            return HttpResponseNotAllowed()

        form = EmailAlertForm(request.POST)

        if form.is_valid():
            form.save()
        else:
            raise ValueError(f"Unable to save email alert for user: {form.errors}")

        return JsonResponse({"success": True})
