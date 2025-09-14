from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.views.generic import (
    ListView,
    DetailView,
    CreateView,
    UpdateView,
    DeleteView,
)
from django.views import View
from django.http import HttpResponse
import csv
import json
from django import forms

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
        # Include form fields for dynamic table columns
        fields = list(self.form_obj.fields.all())
        ctx["fields"] = fields
        # Attach ordered field values to each submission for easy rendering
        submissions = ctx.get("submissions") or []
        for s in submissions:
            s.field_values = [s.data.get(f.key, "") for f in fields]
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


class SubmissionExportCSVView(DashboardMixin, View):
    def get(self, request, *args, **kwargs):
        form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        fields = list(form_obj.fields.all())

        response = HttpResponse(content_type="text/csv")
        filename = f"{form_obj.slug or 'form'}-submissions.csv"
        response["Content-Disposition"] = f"attachment; filename=\"{filename}\""

        writer = csv.writer(response)
        header = ["id", "submitted_at", "user"] + [f.label for f in fields]
        writer.writerow(header)

        for s in form_obj.submissions.order_by("id").all():
            user_str = ""
            if s.user_id and s.user:
                user_str = getattr(s.user, "email", None) or getattr(
                    s.user, "username", None
                ) or str(s.user)

            row = [s.id, s.submitted_at.isoformat(), user_str]
            for f in fields:
                val = s.data.get(f.key, "")
                if isinstance(val, list):
                    val = "; ".join(str(x) for x in val)
                elif isinstance(val, dict):
                    val = json.dumps(val, ensure_ascii=False)
                row.append(val)
            writer.writerow(row)

        return response


def _build_submission_form(form_obj, submission=None, data=None):
    FIELD_TYPE = FormField.FieldType
    dynamic_fields = {}

    for fld in form_obj.fields.all():
        field_kwargs = {
            "label": fld.label,
            "required": bool(fld.required),
            "help_text": fld.help_text,
        }

        initial_val = None
        if submission is not None and submission.data:
            initial_val = submission.data.get(fld.key, None)
        if initial_val is not None:
            field_kwargs["initial"] = initial_val

        if fld.field_type == FIELD_TYPE.TEXT:
            form_field = forms.CharField(**field_kwargs)
        elif fld.field_type == FIELD_TYPE.TEXTAREA:
            form_field = forms.CharField(widget=forms.Textarea(), **field_kwargs)
        elif fld.field_type == FIELD_TYPE.EMAIL:
            form_field = forms.EmailField(**field_kwargs)
        elif fld.field_type == FIELD_TYPE.NUMBER:
            form_field = forms.DecimalField(
                required=fld.required, label=fld.label, help_text=fld.help_text
            )
        elif fld.field_type == FIELD_TYPE.DATE:
            form_field = forms.DateField(
                required=fld.required, label=fld.label, help_text=fld.help_text
            )
        elif fld.field_type == FIELD_TYPE.SELECT:
            choices = [(c, c) for c in fld.choices_list()]
            form_field = forms.ChoiceField(choices=choices, **field_kwargs)
        elif fld.field_type == FIELD_TYPE.MULTISELECT:
            choices = [(c, c) for c in fld.choices_list()]
            # Ensure initial is list-like
            if isinstance(initial_val, str):
                field_kwargs["initial"] = [initial_val]
            form_field = forms.MultipleChoiceField(choices=choices, **field_kwargs)
        elif fld.field_type == FIELD_TYPE.CHECKBOX:
            form_field = forms.BooleanField(**field_kwargs)
        else:
            form_field = forms.CharField(**field_kwargs)

        dynamic_fields[fld.key] = form_field

    SubmissionEditForm = type("SubmissionEditForm", (forms.Form,), dynamic_fields)
    return SubmissionEditForm(data=data) if data is not None else SubmissionEditForm()


class SubmissionUpdateView(DashboardMixin, View):
    template_name = "dashboard/form/submission_form.html"

    def dispatch(self, request, *args, **kwargs):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        self.submission = get_object_or_404(
            FormSubmission, pk=self.kwargs["pk"], form=self.form_obj
        )
        return super().dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):
        form = _build_submission_form(self.form_obj, submission=self.submission)
        return self._render(form)

    def post(self, request, *args, **kwargs):
        form = _build_submission_form(
            self.form_obj, submission=self.submission, data=request.POST
        )
        if form.is_valid():
            # Rebuild JSON payload coherently
            new_data = {}
            for fld in self.form_obj.fields.all():
                val = form.cleaned_data.get(fld.key)
                if val is None:
                    # Keep empty values consistent
                    new_data[fld.key] = "" if not fld.required else ""
                    continue
                if fld.field_type == FormField.FieldType.DATE:
                    new_data[fld.key] = val.isoformat()
                elif fld.field_type == FormField.FieldType.NUMBER:
                    # JSON can't serialize Decimal directly; store as string
                    new_data[fld.key] = str(val)
                elif fld.field_type == FormField.FieldType.MULTISELECT:
                    new_data[fld.key] = list(val)
                elif fld.field_type == FormField.FieldType.CHECKBOX:
                    new_data[fld.key] = bool(val)
                else:
                    new_data[fld.key] = val

            self.submission.data = new_data
            self.submission.save(update_fields=["data"])
            messages.success(request, "Submission updated")
            return redirect(
                "dashboard-form:submission-detail",
                form_id=self.form_obj.id,
                pk=self.submission.id,
            )
        return self._render(form)

    def _render(self, form):
        return render(
            self.request,
            self.template_name,
            {
                "form": form,
                "form_obj": self.form_obj,
                "submission": self.submission,
                "title": "Edit submission",
            },
        )


class SubmissionDeleteView(DashboardMixin, DeleteView):
    model = FormSubmission
    template_name = "dashboard/form/submission_confirm_delete.html"

    def dispatch(self, request, *args, **kwargs):
        self.form_obj = get_object_or_404(Form, pk=self.kwargs["form_id"])
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        return self.form_obj.submissions.all()

    def get_success_url(self):
        messages.success(self.request, "Submission deleted")
        return reverse("dashboard-form:submission-list", kwargs={"form_id": self.form_obj.id})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form_obj"] = self.form_obj
        return ctx
