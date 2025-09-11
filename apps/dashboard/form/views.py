from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.views.generic import (
    ListView,
    DetailView,
    CreateView,
    UpdateView,
    DeleteView,
)

from apps.form.models import Form, FormField, FormSubmission
from apps.form.forms import DynamicFormForm, FormFieldForm


class DashboardMixin(LoginRequiredMixin, PermissionRequiredMixin):
    permission_required = ["is_staff"]

    def has_permission(self):
        return self.request.user.is_staff


class FormListView(DashboardMixin, ListView):
    model = Form
    context_object_name = "forms"
    template_name = "dashboard/form/form_list.html"
    paginate_by = 20


class FormDetailView(DashboardMixin, DetailView):
    model = Form
    context_object_name = "form_obj"
    template_name = "dashboard/form/form_detail.html"


class FormCreateView(DashboardMixin, CreateView):
    model = Form
    form_class = DynamicFormForm
    template_name = "dashboard/form/form_form.html"

    def get_success_url(self):
        return reverse("dashboard-form:form-detail", kwargs={"pk": self.object.pk})


class FormUpdateView(DashboardMixin, UpdateView):
    model = Form
    form_class = DynamicFormForm
    template_name = "dashboard/form/form_form.html"

    def get_success_url(self):
        return reverse("dashboard-form:form-detail", kwargs={"pk": self.object.pk})


class FormDeleteView(DashboardMixin, DeleteView):
    model = Form
    template_name = "dashboard/form/form_confirm_delete.html"
    success_url = reverse_lazy("dashboard-form:form-list")


class FieldListView(DashboardMixin, ListView):
    model = FormField
    context_object_name = "fields"
    template_name = "dashboard/form/field_list.html"

    def get_queryset(self):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        return self.form_obj.fields.all()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form_obj"] = self.form_obj
        return ctx


class FieldCreateView(DashboardMixin, CreateView):
    model = FormField
    form_class = FormFieldForm
    template_name = "dashboard/form/field_form.html"

    def dispatch(self, request, *args, **kwargs):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        form.instance.form = self.form_obj
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("dashboard-form:field-list", kwargs={"form_id": self.form_obj.pk})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form_obj"] = self.form_obj
        return ctx


class FieldUpdateView(DashboardMixin, UpdateView):
    model = FormField
    form_class = FormFieldForm
    template_name = "dashboard/form/field_form.html"

    def dispatch(self, request, *args, **kwargs):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        return self.form_obj.fields.all()

    def get_success_url(self):
        return reverse("dashboard-form:field-list", kwargs={"form_id": self.form_obj.pk})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form_obj"] = self.form_obj
        return ctx


class FieldDeleteView(DashboardMixin, DeleteView):
    model = FormField
    template_name = "dashboard/form/field_confirm_delete.html"

    def dispatch(self, request, *args, **kwargs):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        return self.form_obj.fields.all()

    def get_success_url(self):
        return reverse("dashboard-form:field-list", kwargs={"form_id": self.form_obj.pk})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form_obj"] = self.form_obj
        return ctx


class SubmissionListView(DashboardMixin, ListView):
    model = FormSubmission
    context_object_name = "submissions"
    template_name = "dashboard/form/submission_list.html"
    paginate_by = 50

    def get_queryset(self):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        return self.form_obj.submissions.all()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form_obj"] = self.form_obj
        return ctx


class SubmissionDetailView(DashboardMixin, DetailView):
    model = FormSubmission
    context_object_name = "submission"
    template_name = "dashboard/form/submission_detail.html"

    def dispatch(self, request, *args, **kwargs):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        return self.form_obj.submissions.all()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form_obj"] = self.form_obj
        # For convenience, build label map from current fields
        label_map = {f.key: f.label for f in self.form_obj.fields.all()}
        ctx["label_map"] = label_map
        return ctx

