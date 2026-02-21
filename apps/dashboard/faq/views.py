from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views.generic import ListView, CreateView, UpdateView, DeleteView

from apps.faq.models import FAQItem
from apps.dashboard.faq.forms import FAQItemForm


class DashboardMixin(LoginRequiredMixin, PermissionRequiredMixin):
    permission_required = ["is_staff"]

    def has_permission(self):
        return self.request.user.is_staff


class FAQListView(DashboardMixin, ListView):
    model = FAQItem
    context_object_name = "faq_items"
    template_name = "dashboard/faq/faq_list.html"
    paginate_by = 50


class FAQCreateView(DashboardMixin, CreateView):
    model = FAQItem
    form_class = FAQItemForm
    template_name = "dashboard/faq/faq_form.html"
    success_url = reverse_lazy("dashboard-faq:faq-list")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = _("Create FAQ Item")
        return ctx

    def form_valid(self, form):
        messages.success(self.request, _("FAQ item created successfully."))
        return super().form_valid(form)


class FAQUpdateView(DashboardMixin, UpdateView):
    model = FAQItem
    form_class = FAQItemForm
    template_name = "dashboard/faq/faq_form.html"
    success_url = reverse_lazy("dashboard-faq:faq-list")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = _("Edit FAQ Item")
        return ctx

    def form_valid(self, form):
        messages.success(self.request, _("FAQ item updated successfully."))
        return super().form_valid(form)


class FAQDeleteView(DashboardMixin, DeleteView):
    model = FAQItem
    template_name = "dashboard/faq/faq_confirm_delete.html"
    success_url = reverse_lazy("dashboard-faq:faq-list")

    def form_valid(self, form):
        messages.success(self.request, _("FAQ item deleted successfully."))
        return super().form_valid(form)
