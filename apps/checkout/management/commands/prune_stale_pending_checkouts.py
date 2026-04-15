from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.checkout.models import PendingCheckout


class Command(BaseCommand):
    help = (
        "Delete stale pending checkouts older than the configured age window."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=24,
            help="Minimum age in hours for pending checkouts to be considered stale (default: 24)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many pending checkouts would be deleted without deleting them",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        dry_run = options["dry_run"]

        if hours < 0:
            raise CommandError("--hours must be 0 or greater")

        cutoff = timezone.now() - timedelta(hours=hours)
        stale_qs = PendingCheckout.objects.filter(created_at__lt=cutoff)
        stale_count = stale_qs.count()

        self.stdout.write(
            self.style.NOTICE(
                f"Pruning pending checkouts older than {hours} hours "
                f"(created_before={cutoff.isoformat()})"
            )
        )
        self.stdout.write(f"Found {stale_count} stale pending checkout(s).")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run: no changes applied."))
            return

        deleted_count, _ = stale_qs.delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {deleted_count} stale pending checkout(s).")
        )
