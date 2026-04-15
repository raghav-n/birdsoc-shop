from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from oscar.core.loading import get_model

from apps.checkout.onsite_users import ONSITE_USERNAME
from apps.checkout.models import PendingCheckout

Basket = get_model("basket", "Basket")
UserRecord = get_model("analytics", "UserRecord")


class PruneStalePendingCheckoutsCommandTests(TestCase):
    def _make_pending(self, basket_id, reference, hours_ago):
        pending = PendingCheckout.objects.create(
            basket_id=basket_id,
            email="",
            reference=reference,
            shipping_method_code="ONSITE",
            donation=0,
            basket_snapshot={},
        )
        pending.created_at = timezone.now() - timedelta(hours=hours_ago)
        pending.save(update_fields=["created_at"])
        return pending

    def test_prunes_entries_older_than_default_24_hours(self):
        stale = self._make_pending(1, "MER-OLD", 30)
        fresh = self._make_pending(2, "MER-NEW", 12)

        call_command("prune_stale_pending_checkouts")

        self.assertFalse(PendingCheckout.objects.filter(pk=stale.pk).exists())
        self.assertTrue(PendingCheckout.objects.filter(pk=fresh.pk).exists())

    def test_hours_option_controls_cutoff(self):
        stale = self._make_pending(3, "MER-OLDER", 10)
        fresh = self._make_pending(4, "MER-FRESHER", 4)

        call_command("prune_stale_pending_checkouts", hours=6)

        self.assertFalse(PendingCheckout.objects.filter(pk=stale.pk).exists())
        self.assertTrue(PendingCheckout.objects.filter(pk=fresh.pk).exists())

    def test_dry_run_does_not_delete(self):
        stale = self._make_pending(5, "MER-DRY", 40)
        output = StringIO()

        call_command(
            "prune_stale_pending_checkouts",
            dry_run=True,
            stdout=output,
        )

        self.assertTrue(PendingCheckout.objects.filter(pk=stale.pk).exists())
        self.assertIn("Dry-run: no changes applied.", output.getvalue())