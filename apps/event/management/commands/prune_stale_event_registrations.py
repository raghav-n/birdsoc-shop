from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from oscar.core.loading import get_model

from django.db.models import Q


EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")
EventParticipant = get_model("event", "EventParticipant")


class Command(BaseCommand):
    help = (
        "Cancel stale pending event registrations (and groups) that have no payment proof "
        "and are older than the configured time window. This frees up capacity."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--older-than-minutes",
            "-m",
            type=int,
            default=30,
            help="Minimum age (in minutes) for pending registrations to be pruned (default: 30)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without applying updates",
        )

    def handle(self, *args, **options):
        minutes = options["older_than_minutes"]
        dry_run = options["dry_run"]

        cutoff = timezone.now() - timedelta(minutes=minutes)
        self.stdout.write(
            self.style.NOTICE(
                f"Pruning pending registrations older than {minutes} minutes (created_before={cutoff.isoformat()})"
            )
        )

        # Select groups: pending, not verified, older than cutoff, no payment proof
        stale_groups = EventRegistrationGroup._default_manager.select_related(
            "event"
        ).filter(
            Q(payment_proof__isnull=True) | Q(payment_proof=""),
            status="pending",
            payment_verified=False,
            created_at__lt=cutoff,
        )

        # Select individual regs (not part of a group): pending, not verified, older, no proof
        stale_regs = EventRegistration._default_manager.select_related(
            "event", "participant"
        ).filter(
            Q(payment_proof__isnull=True) | Q(payment_proof=""),
            status="pending",
            payment_verified=False,
            created_at__lt=cutoff,
            group__isnull=True,
        )

        grp_count = stale_groups.count()
        reg_count = stale_regs.count()
        self.stdout.write(
            f"Found {grp_count} pending groups and {reg_count} pending individual registrations to cancel."
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run: no changes applied."))
            return

        with transaction.atomic():
            # Cancel groups first, then child regs
            for grp in stale_groups.select_for_update():
                # Cancel child regs that are still pending
                child_qs = grp.registrations.select_related("participant").filter(
                    status="pending", payment_verified=False
                )
                # Mark corresponding EventParticipants as cancelled for this event
                part_ids = list(child_qs.values_list("participant_id", flat=True))
                if part_ids:
                    EventParticipant._default_manager.filter(
                        event=grp.event, participant_id__in=part_ids
                    ).update(is_cancelled=True)
                updated_children = child_qs.update(status="cancelled")
                grp.status = "cancelled"
                grp.save(update_fields=["status"])
                # Detailed logging for group and children
                self.stdout.write(self.style.WARNING("--- Cancelled Group ---"))
                self.stdout.write(
                    f"Group: id={grp.id}, reference={grp.reference}, event_id={grp.event_id}, "
                    f"event_title={getattr(grp.event, 'title', '')}, payer_name='{grp.payer_name}', "
                    f"payer_email='{grp.payer_email}', amount_total={grp.amount_total}, donation={grp.donation_amount}, "
                    f"currency={grp.currency}, created_at={grp.created_at.isoformat()}"
                )
                for reg in child_qs:
                    p = reg.participant
                    self.stdout.write(
                        f"  Child Registration: id={reg.id}, reference={reg.reference}, status=cancelled, "
                        f"amount={reg.amount}, donation={reg.donation_amount}, participant_id={p.id}, "
                        f"participant='{p.first_name} {p.last_name}', email='{p.email}', qty={p.quantity}, "
                        f"created_at={reg.created_at.isoformat()}"
                    )

            # Cancel individual regs (non-group)
            # For individuals (non-group), cancel participants and then registrations
            for reg in stale_regs.select_for_update():
                EventParticipant._default_manager.filter(
                    event=reg.event, participant=reg.participant
                ).update(is_cancelled=True)
                reg.status = "cancelled"
                reg.save(update_fields=["status"])
                # Detailed logging for individual registration
                p = reg.participant
                e = reg.event
                self.stdout.write(
                    self.style.WARNING("--- Cancelled Individual Registration ---")
                )
                self.stdout.write(
                    f"Registration: id={reg.id}, reference={reg.reference}, event_id={reg.event_id}, "
                    f"event_title={getattr(e, 'title', '')}, status=cancelled, amount={reg.amount}, donation={reg.donation_amount}, "
                    f"currency={reg.currency}, created_at={reg.created_at.isoformat()}"
                )
                self.stdout.write(
                    f"  Participant: id={p.id}, name='{p.first_name} {p.last_name}', email='{p.email}', "
                    f"phone='{p.phone_number}', qty={p.quantity}"
                )
            if reg_count:
                self.stdout.write(f"Cancelled {reg_count} individual registrations.")

        self.stdout.write(self.style.SUCCESS("Prune complete."))
