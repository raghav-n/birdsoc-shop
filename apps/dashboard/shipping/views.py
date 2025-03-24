from django.contrib.admin.views.decorators import staff_member_required
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from oscar.core.loading import get_model
from django.views.generic import ListView, CreateView, UpdateView, DeleteView


@method_decorator(staff_member_required, name="dispatch")
class DynamicShippingMethodListView(ListView):
    template_name = "oscar/dashboard/shipping/shipping_methods_list.html"
    context_object_name = "shipping_methods"

    def get_queryset(self):
        DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
        return DynamicShippingMethod._default_manager.all()


@method_decorator(staff_member_required, name="dispatch")
class DynamicShippingMethodCreateView(CreateView):
    fields = [
        "name",
        "active",
        "end_date",
        "code",
        "description",
        "email_description",
        "email_description_full",
        "website_home_description",
        "website_faq_description",
        "price",
        "is_self_collect",
        "available_to_public",
    ]
    template_name = "oscar/dashboard/shipping/shipping_method_form.html"
    success_url = reverse_lazy("dashboard:dynamic-shipping-method-list")

    def get_queryset(self):
        DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
        return DynamicShippingMethod._default_manager.all()


class DynamicShippingMethodUpdateView(UpdateView):
    fields = [
        "name",
        "active",
        "end_date",
        "code",
        "description",
        "email_description",
        "email_description_full",
        "website_home_description",
        "website_faq_description",
        "price",
        "is_self_collect",
        "available_to_public",
    ]
    template_name = "oscar/dashboard/shipping/shipping_method_form.html"
    success_url = reverse_lazy("dashboard:dynamic-shipping-method-list")

    def get_queryset(self):
        DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
        return DynamicShippingMethod._default_manager.all()


class DynamicShippingMethodDeleteView(DeleteView):
    template_name = "oscar/dashboard/shipping/shipping_method_confirm_delete.html"
    success_url = reverse_lazy("dashboard:dynamic-shipping-method-list")

    def get_queryset(self):
        DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
        return DynamicShippingMethod._default_manager.all()
