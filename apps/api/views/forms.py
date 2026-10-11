from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.form.models import Form, FormInvite
from apps.form.services import clean_submission


def serialize_field(f):
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
    return item


def _resolve_invite(request, form_obj):
    """
    Return (invite, error_response). A personal link passes ``?token=``; a
    token for another form or a malformed one is treated as not found.
    """
    token = request.query_params.get("token")
    if not token:
        return None, None
    try:
        invite = (
            FormInvite.objects.select_related(
                "event_participant__participant", "event_participant__event"
            )
            .get(form=form_obj, token=token)
        )
    except (FormInvite.DoesNotExist, ValueError, ValidationError):
        return None, Response(
            {"detail": "This feedback link isn't valid."}, status=status.HTTP_404_NOT_FOUND
        )
    return invite, None


class FormSubmissionView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug):
        form_obj = get_object_or_404(Form, slug=slug, is_active=True)
        if not form_obj.accept_submissions:
            return Response(
                {"detail": "Submissions are closed for this form."},
                status=status.HTTP_403_FORBIDDEN,
            )
        invite, err = _resolve_invite(request, form_obj)
        if err:
            return err
        if invite is None and not form_obj.allow_anonymous:
            return Response(
                {"detail": "Please use the personal link from your email to respond."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payload = request.data if hasattr(request, "data") else request.POST
        cleaned, errors = clean_submission(form_obj, payload)
        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        meta = {
            "user": request.user if request.user and request.user.is_authenticated else None,
            "submitter_ip": request.META.get("REMOTE_ADDR"),
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:255],
            "data": cleaned,
        }
        # A personal link keeps one response per booking; resubmitting edits it.
        if invite is not None:
            sub, created = form_obj.submissions.update_or_create(invite=invite, defaults=meta)
        else:
            sub, created = form_obj.submissions.create(**meta), True
        return Response(
            {
                "id": sub.id,
                "message": form_obj.success_message or "Submitted",
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class FormSchemaView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        form_obj = get_object_or_404(Form, slug=slug, is_active=True)
        invite, err = _resolve_invite(request, form_obj)
        if err:
            return err

        data = {
            "slug": form_obj.slug,
            "name": form_obj.name,
            "description": form_obj.description,
            "is_active": form_obj.is_active,
            "accept_submissions": form_obj.accept_submissions,
            "allow_anonymous": form_obj.allow_anonymous,
            "success_message": form_obj.success_message,
            "created_at": form_obj.created_at,
            "updated_at": form_obj.updated_at,
            "fields": [serialize_field(f) for f in form_obj.fields.all()],
            "submit_url": f"/api/v1/forms/{form_obj.slug}/submit",
            "respondent": None,
            "existing_response": None,
        }
        if invite is not None:
            ep = invite.event_participant
            data["respondent"] = {
                "first_name": ep.participant.first_name,
                "event": ep.event.title,
            }
            sub = getattr(invite, "submission", None)
            if sub is not None:
                data["existing_response"] = {
                    "data": sub.data,
                    "submitted_at": sub.updated_at or sub.submitted_at,
                }
        return Response(data)
