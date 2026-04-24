from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.shortcuts import redirect
from django.views.generic import View

from apps.home.forms import ShopConfigForm
from apps.home.models import ShopConfig


class DashboardMixin(LoginRequiredMixin, PermissionRequiredMixin):
    permission_required = ["is_staff"]

    def has_permission(self):
        return self.request.user.is_staff


class ShopConfigUpdateView(DashboardMixin, View):
    def post(self, request):
        instance = ShopConfig.get()
        form = ShopConfigForm(request.POST, instance=instance)
        if form.is_valid():
            form.save()
            messages.success(request, "Shop configuration updated.")
        else:
            messages.error(request, "Invalid shop configuration.")
        return redirect("dashboard:index")
