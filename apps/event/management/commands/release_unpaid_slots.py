"""
Cancel pending paid event registrations that are older than 15 minutes and
have no payment proof uploaded, then notify the registrant by email.

Only targets registrations where the event fee (amount) is > 0.
Free events where the user added a voluntary donation are NOT cancelled —
there is no obligation to pay within any time window.

Run every minute via cron:
    * * * * * /path/to/venv/bin/python /path/to/manage.py release_unpaid_slots
"""
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from oscar.core.loading import get_model

from apps.event.utils import send_slot_released_email

EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")
EventParticipant = get_model("event", "EventParticipant")

WINDOW_MINUTES = 15


class Command(BaseCommand):
    help = (
        f"Cancel pending paid event registrations older than {WINDOW_MINUTES} minutes "
        "with no payment proof and notify the registrant."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be cancelled without making changes.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(minutes=WINDOW_MINUTES)

        # Individual paid registrations: amount > 0, pending, no proof, old enough
        stale_regs = (
            EventRegistration._default_manager
            .select_related("event", "participant")
            .filter(
                Q(payment_proof__isnull=True) | Q(payment_proof=""),
                status="pending",
                payment_verified=False,
                created_at__lt=cutoff,
                group__isnull=True,
            )
            .exclude(amount__lte=Decimal("0"))
        )

        # Paid group registrations: amount_total > 0, pending, no proof, old enough
        stale_groups = (
            EventRegistrationGroup._default_manager
            .prefetch_related("registrations__participant")
            .select_related("event")
            .filter(
                Q(payment_proof__isnull=True) | Q(payment_proof=""),
                status="pending",
                payment_verified=False,
                created_at__lt=cutoff,
            )
            .exclude(amount_total__lte=Decimal("0"))
        )

        reg_count = stale_regs.count()
        grp_count = stale_groups.count()

        if reg_count == 0 and grp_count == 0:
            return

        self.stdout.write(
            f"[release_unpaid_slots] {reg_count} individual + {grp_count} group registrations to release."
        )

        if dry_run:
            for reg in stale_regs:
                self.stdout.write(
                    f"  DRY-RUN reg id={reg.id} ref={reg.reference} "
                    f"amount={reg.amount} email={reg.participant.email}"
                )
            for grp in stale_groups:
                self.stdout.write(
                    f"  DRY-RUN group id={grp.id} ref={grp.reference} "
                    f"amount={grp.amount_total} email={grp.payer_email}"
                )
            self.stdout.write(self.style.WARNING("Dry-run: no changes applied."))
            return

        with transaction.atomic():
            for reg in stale_regs.select_for_update():
                EventParticipant._default_manager.filter(
                    event=reg.event, participant=reg.participant
                ).update(is_cancelled=True)
                reg.status = "cancelled"
                reg.save(update_fields=["status"])
                self.stdout.write(
                    f"  Cancelled reg id={reg.id} ref={reg.reference} "
                    f"({reg.participant.email})"
                )
                send_slot_released_email(registration=reg)

            for grp in stale_groups.select_for_update():
                child_qs = grp.registrations.filter(status="pending", payment_verified=False)
                part_ids = list(child_qs.values_list("participant_id", flat=True))
                if part_ids:
                    EventParticipant._default_manager.filter(
                        event=grp.event, participant_id__in=part_ids
                    ).update(is_cancelled=True)
                child_qs.update(status="cancelled")
                grp.status = "cancelled"
                grp.save(update_fields=["status"])
                self.stdout.write(
                    f"  Cancelled group id={grp.id} ref={grp.reference} "
                    f"({grp.payer_email})"
                )
                send_slot_released_email(group=grp)

        self.stdout.write(
            self.style.SUCCESS(
                f"[release_unpaid_slots] Released {reg_count} registrations, {grp_count} groups."
            )
        )
