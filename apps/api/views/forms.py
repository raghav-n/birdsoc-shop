from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from apps.form.models import Form


class FormSubmissionView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug):
        form_obj = get_object_or_404(Form, slug=slug, is_active=True)
        if not form_obj.accept_submissions:
            return Response(
                {"detail": "Submissions are closed for this form."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payload = request.data if hasattr(request, "data") else request.POST
        # Validate against configured fields
        errors = {}
        cleaned = {}
        fields = list(form_obj.fields.all())
        field_map = {f.key: f for f in fields}

        # Check requireds and types
        for f in fields:
            raw = payload.get(f.key)
            if raw in (None, ""):
                if f.required:
                    errors[f.key] = "This field is required."
                continue

            if f.field_type in ("text", "textarea"):
                cleaned[f.key] = str(raw)
            elif f.field_type == "email":
                val = str(raw)
                if "@" not in val or "." not in val.split("@")[-1]:
                    errors[f.key] = "Enter a valid email address."
                else:
                    cleaned[f.key] = val
            elif f.field_type == "number":
                try:
                    cleaned[f.key] = float(raw)
                except Exception:
                    errors[f.key] = "Enter a valid number."
            elif f.field_type == "date":
                cleaned[f.key] = str(raw)
            elif f.field_type == "checkbox":
                # Accept true/false variants
                val = str(raw).lower() in ("1", "true", "yes", "on")
                cleaned[f.key] = val
            elif f.field_type == "select":
                val = str(raw)
                options = f.choices_list()
                if options and val not in options:
                    errors[f.key] = "Invalid choice."
                else:
                    cleaned[f.key] = val
            elif f.field_type == "multiselect":
                vals = payload.getlist(f.key) if hasattr(payload, "getlist") else payload.get(f.key)
                if isinstance(vals, str):
                    # Comma separated string fallback
                    vals = [v.strip() for v in vals.split(",") if v.strip()]
                if not isinstance(vals, (list, tuple)):
                    errors[f.key] = "Enter a list of values."
                else:
                    options = f.choices_list()
                    if options:
                        invalid = [v for v in vals if v not in options]
                        if invalid:
                            errors[f.key] = "Invalid choice(s): " + ", ".join(invalid)
                    cleaned[f.key] = list(vals)
            else:
                cleaned[f.key] = str(raw)

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Allow extra payload keys but ignore them (only store configured keys)
        # Create submission
        sub = form_obj.submissions.create(
            user=request.user if request.user and request.user.is_authenticated else None,
            submitter_ip=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            data=cleaned,
        )
        return Response(
            {
                "id": sub.id,
                "message": form_obj.success_message or "Submitted",
            },
            status=status.HTTP_201_CREATED,
        )


class FormSchemaView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        form_obj = get_object_or_404(Form, slug=slug, is_active=True)
        fields_payload = []
        for f in form_obj.fields.all():
            item = {
                "key": f.key,
                "label": f.label,
                "type": f.field_type,
                "required": f.required,
                "display": f.display,
                "help_text": f.help_text,
                "placeholder": f.placeholder,
                "default_value": f.default_value,
                "order": f.order,
            }
            choices = f.choices_list()
            if choices:
                item["choices"] = choices
            fields_payload.append(item)

        data = {
            "slug": form_obj.slug,
            "name": form_obj.name,
            "description": form_obj.description,
            "is_active": form_obj.is_active,
            "accept_submissions": form_obj.accept_submissions,
            "success_message": form_obj.success_message,
            "created_at": form_obj.created_at,
            "updated_at": form_obj.updated_at,
            "fields": fields_payload,
            "submit_url": f"/api/v1/forms/{form_obj.slug}/submit",
        }
        return Response(data)
