"""
Console-side form builder and feedback responses.
All endpoints require the user to be in the 'Events' group (or be a superuser).
"""
import csv
from collections import Counter, defaultdict

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils.text import slugify
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from oscar.core.loading import get_model

from apps.api.permissions import IsEventsStaff
from apps.api.views.forms import serialize_field
from apps.form.models import Form, FormField
from apps.form.services import (
    DEFAULT_EMAIL_BODY,
    DEFAULT_EMAIL_SUBJECT,
    eligible_participants,
    invite_link,
    public_link,
    send_invite_batch,
)

EventGroup = get_model("event", "EventGroup")

FIELD_TYPES = {c for c, _ in FormField.FieldType.choices}
FORM_ATTRS = (
    "name", "description", "is_active", "accept_submissions", "allow_anonymous",
    "success_message", "email_subject", "email_body",
)
MAX_SEND_BATCH = 50


def _serialize_form(form_obj, include_fields=False):
    data = {
        "id": form_obj.id,
        "name": form_obj.name,
        "slug": form_obj.slug,
        "description": form_obj.description,
        "is_active": form_obj.is_active,
        "accept_submissions": form_obj.accept_submissions,
        "allow_anonymous": form_obj.allow_anonymous,
        "success_message": form_obj.success_message,
        "email_subject": form_obj.email_subject,
        "email_body": form_obj.email_body,
        "default_email_subject": DEFAULT_EMAIL_SUBJECT,
        "default_email_body": DEFAULT_EMAIL_BODY,
        "event_group": (
            {"id": form_obj.event_group.id, "name": form_obj.event_group.name}
            if form_obj.event_group_id else None
        ),
        "public_url": public_link(form_obj),
        "created_at": form_obj.created_at,
        "updated_at": form_obj.updated_at,
        "response_count": form_obj.submissions.count(),
        "invite_count": form_obj.invites.count(),
    }
    if include_fields:
        data["fields"] = [{"id": f.id, **serialize_field(f)} for f in form_obj.fields.all()]
    return data


def _clean_fields(raw_fields):
    """Validate the builder's field list. Returns (cleaned list, error)."""
    if not isinstance(raw_fields, list):
        return None, "fields must be a list"
    cleaned, seen = [], set()
    for i, raw in enumerate(raw_fields):
        if not isinstance(raw, dict):
            return None, "Each field must be an object"
        label = str(raw.get("label") or "").strip()
        if not label:
            return None, f"Question {i + 1} needs a label"
        key = slugify(str(raw.get("key") or "").strip() or label)[:50].replace("-", "_")
        if not key:
            return None, f"Question {i + 1} needs a key"
        base, n = key, 2
        while key in seen:
            key = f"{base[:46]}_{n}"
            n += 1
        seen.add(key)
        field_type = raw.get("type") or "text"
        if field_type not in FIELD_TYPES:
            return None, f"Unknown field type: {field_type}"
        choices = raw.get("choices") or []
        if isinstance(choices, str):
            choices = choices.splitlines()
        choices = [str(c).strip() for c in choices if str(c).strip()]
        if field_type in ("select", "multiselect") and not choices:
            return None, f'"{label}" needs at least one option'
        cleaned.append({
            "id": raw.get("id"),
            "key": key,
            "label": label[:200],
            "help_text": str(raw.get("help_text") or "").strip()[:255],
            "field_type": field_type,
            "required": bool(raw.get("required", False)),
            "placeholder": str(raw.get("placeholder") or "").strip()[:200],
            "choices": "\n".join(choices) if field_type in ("select", "multiselect") else "",
            "order": i,
        })
    return cleaned, None


def _save_fields(form_obj, cleaned):
    """
    Replace the form's fields with ``cleaned``, keeping ids where given.
    Responses are keyed by field key, so the builder sends existing keys back
    unchanged and only new questions get a key derived from their label.
    """
    existing = {f.id: f for f in form_obj.fields.all()}
    # Park existing keys first so reordering or swapping keys can't trip unique_together.
    for f in existing.values():
        f.key = f"__tmp_{f.pk}"
        f.save(update_fields=["key"])
    keep = set()
    for item in cleaned:
        fid = item.pop("id", None)
        field = existing.get(fid) if isinstance(fid, int) else None
        if field is None:
            field = FormField(form=form_obj)
        for k, v in item.items():
            setattr(field, k, v)
        field.save()
        keep.add(field.pk)
    form_obj.fields.exclude(pk__in=keep).delete()


def _apply(form_obj, data):
    """Apply builder payload to ``form_obj`` (unsaved or saved). Returns error or None."""
    for attr in FORM_ATTRS:
        if attr in data:
            val = data[attr]
            if attr in ("is_active", "accept_submissions", "allow_anonymous"):
                val = bool(val)
            else:
                val = str(val or "").strip()
            setattr(form_obj, attr, val)
    if not form_obj.name:
        return "Form name is required"
    if form_obj.email_body and "{link}" not in form_obj.email_body:
        return "The invite email needs a {link} placeholder for the personal link"
    if "slug" in data:
        slug = slugify(str(data["slug"] or "").strip())
        if not slug:
            return "Link name is required"
        form_obj.slug = slug[:200]
    elif not form_obj.slug:
        form_obj.slug = slugify(form_obj.name)[:200]
    if "event_group_id" in data:
        gid = data["event_group_id"]
        if gid in (None, ""):
            form_obj.event_group = None
        else:
            try:
                form_obj.event_group = EventGroup.objects.get(pk=gid)
            except (EventGroup.DoesNotExist, ValueError, TypeError):
                return "Unknown event group"
    return None


def _get_form(form_id):
    return Form.objects.select_related("event_group").get(pk=form_id)


def _save(form_obj, data, created):
    err = _apply(form_obj, data)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    cleaned = None
    if "fields" in data:
        cleaned, err = _clean_fields(data["fields"])
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    if Form.objects.filter(slug=form_obj.slug).exclude(pk=form_obj.pk).exists():
        return Response(
            {"detail": f'The link name "{form_obj.slug}" is already used by another form'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        with transaction.atomic():
            form_obj.save()
            if cleaned is not None:
                _save_fields(form_obj, cleaned)
    except IntegrityError:
        return Response({"detail": "Could not save the form"}, status=status.HTTP_400_BAD_REQUEST)
    return Response(
        _serialize_form(_get_form(form_obj.pk), include_fields=True),
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


class ConsoleFormsView(APIView):
    permission_classes = [IsEventsStaff]

    def get(self, request):
        forms = Form.objects.select_related("event_group").all()
        return Response({
            "forms": [_serialize_form(f) for f in forms],
            "event_groups": [
                {"id": g.id, "name": g.name}
                for g in EventGroup.objects.order_by("-created_at")
            ],
            "default_email_subject": DEFAULT_EMAIL_SUBJECT,
            "default_email_body": DEFAULT_EMAIL_BODY,
        })

    def post(self, request):
        return _save(Form(), request.data, created=True)


class ConsoleFormDetailView(APIView):
    permission_classes = [IsEventsStaff]

    def get(self, request, form_id: int):
        try:
            form_obj = _get_form(form_id)
        except Form.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_form(form_obj, include_fields=True))

    def patch(self, request, form_id: int):
        try:
            form_obj = _get_form(form_id)
        except Form.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return _save(form_obj, request.data, created=False)

    def delete(self, request, form_id: int):
        deleted, _ = Form.objects.filter(pk=form_id).delete()
        if not deleted:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Responses ────────────────────────────────────────────────────────────────


def _respondent(sub):
    invite = sub.invite
    if invite is None:
        return None
    ep = invite.event_participant
    p = ep.participant
    return {
        "ep_id": ep.id,
        "name": f"{p.first_name} {p.last_name}".strip(),
        "email": p.email,
        "party_size": p.quantity,
        "event": {"id": ep.event.id, "title": ep.event.title},
    }


def _submissions(form_obj):
    return form_obj.submissions.select_related(
        "invite__event_participant__participant", "invite__event_participant__event"
    ).order_by("-submitted_at")


SITE_FIELD_KEY = "site"


def _site_of(sub):
    """The respondent's site: their own answer to a ``site`` question, else their booking's event."""
    answer = sub.data.get(SITE_FIELD_KEY)
    if isinstance(answer, str) and answer:
        return answer
    r = _respondent(sub)
    return r["event"]["title"] if r else None


def _summarise(fields, subs):
    """Per-question aggregates, plus per-site averages for rating questions."""
    summary = []
    for f in fields:
        answers = [(s, s.data.get(f.key)) for s in subs if s.data.get(f.key) not in (None, "", [])]
        item = {"key": f.key, "label": f.label, "type": f.field_type, "answered": len(answers)}
        if f.field_type in ("rating", "scale", "number"):
            nums = [float(v) for _, v in answers if isinstance(v, (int, float))]
            item["average"] = round(sum(nums) / len(nums), 2) if nums else None
            if f.field_type in ("rating", "scale"):
                lo, hi = (1, 5) if f.field_type == "rating" else (0, 10)
                counts = Counter(int(n) for n in nums)
                item["distribution"] = [{"value": v, "count": counts.get(v, 0)} for v in range(lo, hi + 1)]
                by_site = defaultdict(list)
                for s, v in answers:
                    site = _site_of(s)
                    if site and isinstance(v, (int, float)):
                        by_site[site].append(float(v))
                item["by_site"] = [
                    {"event": site, "average": round(sum(v) / len(v), 2), "count": len(v)}
                    for site, v in sorted(by_site.items())
                ]
            if f.field_type == "scale" and nums:
                promoters = sum(1 for n in nums if n >= 9)
                detractors = sum(1 for n in nums if n <= 6)
                item["nps"] = round(100 * (promoters - detractors) / len(nums))
        elif f.field_type in ("select", "multiselect", "checkbox"):
            counts = Counter()
            for _, v in answers:
                if isinstance(v, list):
                    counts.update(str(x) for x in v)
                elif isinstance(v, bool):
                    counts["Yes" if v else "No"] += 1
                else:
                    counts[str(v)] += 1
            order = f.choices_list() or ["Yes", "No"]
            options = order + sorted(k for k in counts if k not in order)
            item["counts"] = [{"value": o, "count": counts.get(o, 0)} for o in options]
        summary.append(item)
    return summary


class ConsoleFormResponsesView(APIView):
    permission_classes = [IsEventsStaff]

    def get(self, request, form_id: int):
        try:
            form_obj = _get_form(form_id)
        except Form.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        fields = list(form_obj.fields.all())
        subs = list(_submissions(form_obj))
        return Response({
            "form": _serialize_form(form_obj, include_fields=True),
            "summary": _summarise(fields, subs),
            "responses": [
                {
                    "id": s.id,
                    "submitted_at": s.submitted_at,
                    "updated_at": s.updated_at,
                    "respondent": _respondent(s),
                    "data": s.data,
                }
                for s in subs
            ],
        })


def _csv_value(v):
    if isinstance(v, list):
        return "; ".join(map(str, v))
    if isinstance(v, bool):
        return "Yes" if v else "No"
    return "" if v is None else v


class ConsoleFormResponsesCsvView(APIView):
    permission_classes = [IsEventsStaff]

    def get(self, request, form_id: int):
        try:
            form_obj = _get_form(form_id)
        except Form.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        fields = list(form_obj.fields.all())
        resp = HttpResponse(content_type="text/csv")
        resp["Content-Disposition"] = f'attachment; filename="{form_obj.slug}-responses.csv"'
        writer = csv.writer(resp)
        writer.writerow(["Submitted", "Name", "Email", "Site", "Party size"] + [f.label for f in fields])
        for s in _submissions(form_obj):
            r = _respondent(s) or {}
            writer.writerow(
                [
                    (s.updated_at or s.submitted_at).strftime("%Y-%m-%d %H:%M"),
                    r.get("name", ""),
                    r.get("email", ""),
                    (r.get("event") or {}).get("title", ""),
                    r.get("party_size", ""),
                ]
                + [_csv_value(s.data.get(f.key)) for f in fields]
            )
        return resp


# ─── Invites ──────────────────────────────────────────────────────────────────


def _attended_only(request):
    raw = request.query_params.get("attended_only") or request.data.get("attended_only")
    return str(raw).lower() in ("1", "true", "yes", "on")


class ConsoleFormInvitesView(APIView):
    """
    GET lists every eligible booking in the form's event group with its invite
    status (link, emailed, responded). POST sends the next batch of invite
    emails; the console calls it until ``remaining`` is zero.
    """
    permission_classes = [IsEventsStaff]

    def get(self, request, form_id: int):
        try:
            form_obj = _get_form(form_id)
        except Form.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        invites = {
            i.event_participant_id: i
            for i in form_obj.invites.select_related("submission")
        }
        rows = []
        for ep in eligible_participants(form_obj):
            p = ep.participant
            invite = invites.get(ep.id)
            sub = getattr(invite, "submission", None) if invite else None
            rows.append({
                "ep_id": ep.id,
                "name": f"{p.first_name} {p.last_name}".strip(),
                "email": p.email,
                "party_size": p.quantity,
                "attended": ep.attended,
                "event": {"id": ep.event.id, "title": ep.event.title},
                "link": invite_link(invite) if invite else None,
                "emailed_at": invite.emailed_at if invite else None,
                "responded_at": (sub.updated_at or sub.submitted_at) if sub else None,
            })
        return Response({"has_group": bool(form_obj.event_group_id), "participants": rows})

    def post(self, request, form_id: int):
        try:
            form_obj = _get_form(form_id)
        except Form.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not form_obj.event_group_id:
            return Response(
                {"detail": "Link this form to an event group before sending invites"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not form_obj.is_active or not form_obj.accept_submissions:
            return Response(
                {"detail": "Turn on the form and accept responses before sending invites"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            limit = min(max(int(request.data.get("limit", 20)), 1), MAX_SEND_BATCH)
        except (TypeError, ValueError):
            limit = 20
        return Response(send_invite_batch(form_obj, _attended_only(request), limit=limit))
