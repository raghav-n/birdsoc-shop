from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views.generic import ListView, CreateView, UpdateView, DeleteView, View
from django.shortcuts import render, redirect

from apps.banner.models import BannerImage, TextBanner
from apps.dashboard.banner.forms import BannerImageForm, TextBannerForm


class DashboardMixin(LoginRequiredMixin, PermissionRequiredMixin):
    permission_required = ["is_staff"]

    def has_permission(self):
        return self.request.user.is_staff


class BannerListView(DashboardMixin, ListView):
    model = BannerImage
    context_object_name = "banners"
    template_name = "dashboard/banner/banner_list.html"
    paginate_by = 50


class BannerCreateView(DashboardMixin, CreateView):
    model = BannerImage
    form_class = BannerImageForm
    template_name = "dashboard/banner/banner_form.html"
    success_url = reverse_lazy("dashboard-banner:banner-list")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = _("Add Banner Image")
        return ctx

    def form_valid(self, form):
        messages.success(self.request, _("Banner image added successfully."))
        return super().form_valid(form)


class BannerUpdateView(DashboardMixin, UpdateView):
    model = BannerImage
    form_class = BannerImageForm
    template_name = "dashboard/banner/banner_form.html"
    success_url = reverse_lazy("dashboard-banner:banner-list")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = _("Edit Banner Image")
        return ctx

    def form_valid(self, form):
        messages.success(self.request, _("Banner image updated successfully."))
        return super().form_valid(form)


class TextBannerView(DashboardMixin, View):
    template_name = "dashboard/banner/text_banner_form.html"

    def get(self, request):
        instance, _created = TextBanner.objects.get_or_create(pk=1)
        form = TextBannerForm(instance=instance)
        return render(request, self.template_name, {"form": form, "object": instance})

    def post(self, request):
        instance, _created = TextBanner.objects.get_or_create(pk=1)
        form = TextBannerForm(request.POST, instance=instance)
        if form.is_valid():
            form.save()
            messages.success(request, _("Text banner updated successfully."))
            return redirect("dashboard-banner:banner-text")
        return render(request, self.template_name, {"form": form, "object": instance})


class BannerDeleteView(DashboardMixin, DeleteView):
    model = BannerImage
    template_name = "dashboard/banner/banner_confirm_delete.html"
    success_url = reverse_lazy("dashboard-banner:banner-list")

    def form_valid(self, form):
        messages.success(self.request, _("Banner image deleted successfully."))
        return super().form_valid(form)
