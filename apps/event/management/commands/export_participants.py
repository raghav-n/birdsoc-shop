from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
import csv
import sys

from apps.event.models import OrganizedEvent, EventParticipant


class Command(BaseCommand):
    help = (
        "Export confirmed participants for events matching a search term (case-insensitive) "
        "and not containing an exclusion term into a CSV. Extra JSON fields are expanded into columns."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            "-o",
            help="Output CSV file path. Defaults to stdout.",
            default=None,
        )
        parser.add_argument(
            "--search",
            "-s",
            help="Case-insensitive substring to search for in event titles. If omitted, all events are considered.",
            default=None,
        )
        parser.add_argument(
            "--exclude",
            "-x",
            help="Case-insensitive substring to exclude from event titles. If omitted, no exclusion is applied.",
            default=None,
        )

    def handle(self, *args, **options):
        out_path = options.get("output")
        # None or empty means no filter
        search_opt = options.get("search")
        exclude_opt = options.get("exclude")

        search = (search_opt or "").strip()
        exclude = (exclude_opt or "").strip()

        # Start with all events and apply filters only when provided
        events_qs = OrganizedEvent.objects.all()
        if search:
            events_qs = events_qs.filter(title__icontains=search)
        if exclude:
            events_qs = events_qs.exclude(title__icontains=exclude)

        # Get confirmed event participants for these events
        eps = EventParticipant.objects.filter(
            event__in=events_qs, is_confirmed=True, is_cancelled=False
        ).select_related("event", "participant")

        # Collect all extra_json keys
        extra_keys = set()
        rows = []

        # Preload EventRegistration rows for the events/participants to avoid N+1 queries.
        # Map key (event_id, participant_id) -> registration instance (prefer latest by created_at)
        from apps.event.models import EventRegistration

        reg_qs = EventRegistration.objects.filter(event__in=events_qs, participant__in=[ep.participant for ep in eps])
        # use select_related to fetch group
        reg_qs = reg_qs.select_related("group").order_by("-created_at")
        reg_map = {}
        for reg in reg_qs:
            key = (reg.event_id, reg.participant_id)
            # prefer the first (latest) registration found
            if key not in reg_map:
                reg_map[key] = reg

        for ep in eps:
            pdata = ep.extra_json or {}
            if not isinstance(pdata, dict):
                # skip malformed extras
                pdata = {}
            extra_keys.update(pdata.keys())
            row = {
                "event_id": ep.event.id,
                "event_title": ep.event.title,
                "event_location": ep.event.location,
                "event_start": ep.event.start_date.isoformat()
                if ep.event.start_date
                else "",
                "participant_id": ep.participant.id,
                "first_name": ep.participant.first_name,
                "last_name": ep.participant.last_name,
                "email": ep.participant.email,
                "phone_number": ep.participant.phone_number,
                "quantity": ep.participant.quantity,
                "registered_at": ep.registered_at.isoformat()
                if ep.registered_at
                else "",
                # registration_reference: prefer group reference if linked, else registration reference
                "registration_reference": "",
                "is_main_contact": ep.is_main_contact,
                "attended": ep.attended,
                "notes": ep.notes,
            }
            # fill registration_reference from reg_map if available
            reg_key = (ep.event_id, ep.participant_id) if hasattr(ep, "event_id") and hasattr(ep, "participant_id") else (ep.event.id, ep.participant.id)
            reg = reg_map.get(reg_key)
            if reg:
                if getattr(reg, "group", None) and getattr(reg.group, "reference", None):
                    row["registration_reference"] = reg.group.reference
                else:
                    row["registration_reference"] = getattr(reg, "reference", "")
            # merge extra fields (stringify values)
            for k, v in pdata.items():
                row[k] = v
            rows.append(row)

        # Prepare headers: fixed fields followed by sorted extra keys
        fixed_headers = [
            "event_id",
            "event_title",
            "event_location",
            "event_start",
            "participant_id",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "quantity",
            "registered_at",
            "registration_reference",
            "is_main_contact",
            "attended",
            "notes",
        ]
        extra_headers = sorted(extra_keys)
        headers = fixed_headers + extra_headers

        # Open output
        if out_path:
            out_file = open(out_path, "w", newline="", encoding="utf-8")
        else:
            out_file = sys.stdout

        writer = csv.DictWriter(out_file, fieldnames=headers)
        writer.writeheader()
        for r in rows:
            # ensure all keys exist
            out_row = {h: (r.get(h) if r.get(h) is not None else "") for h in headers}
            writer.writerow(out_row)

        if out_path:
            out_file.close()
            self.stdout.write(
                self.style.SUCCESS(f"Exported {len(rows)} rows to {out_path}")
            )
        else:
            # If writing to stdout, just flush
            try:
                out_file.flush()
            except Exception:
                pass
