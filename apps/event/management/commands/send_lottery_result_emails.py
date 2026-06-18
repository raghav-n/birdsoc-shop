"""
Deliver lottery result emails (won/lost) for events whose draw has run.

``run_lottery_draw`` deliberately does NOT email entrants in-request — sending
dozens of messages synchronously blew past the gunicorn worker timeout and got
the worker SIGKILL'd mid-loop, leaving some entrants un-emailed and no way to
retry (the draw was already marked done). Instead each drawn entry is left with
``lottery_result_email_sent_at = NULL``; this command picks those up, sends the
right email, and stamps the timestamp only on success — so it is safe to re-run
and resumes exactly where a previous run stopped.

Run every minute via cron:
    * * * * * /srv/shop/venv/bin/python /srv/shop/manage.py send_lottery_result_emails
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone
from oscar.core.loading import get_model

from apps.event import utils

OrganizedEvent = get_model("event", "OrganizedEvent")
EventParticipant = get_model("event", "EventParticipant")

# Cap per run so a single invocation can't run unbounded; the next cron tick
# picks up the remainder.
DEFAULT_LIMIT = 200


class Command(BaseCommand):
    help = "Send pending lottery won/lost result emails for events whose draw has run."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List what would be sent without sending or marking anything.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=DEFAULT_LIMIT,
            help=f"Max emails to send this run (default {DEFAULT_LIMIT}).",
        )
        parser.add_argument(
            "--event",
            type=int,
            default=None,
            help="Restrict to a single event id.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        limit = options["limit"]
        event_id = options["event"]

        pending = (
            EventParticipant._default_manager
            .select_related("event", "participant")
            .filter(
                event__signup_mode=OrganizedEvent.SIGNUP_MODE_LOTTERY,
                event__lottery_drawn_at__isnull=False,
                is_cancelled=False,
                lottery_result_email_sent_at__isnull=True,
            )
            .filter(Q(is_lottery_lost=True) | Q(is_confirmed=True))
            .order_by("event_id", "id")
        )
        if event_id is not None:
            pending = pending.filter(event_id=event_id)

        total = pending.count()
        if total == 0:
            return

        self.stdout.write(
            f"[send_lottery_result_emails] {total} pending result email(s); "
            f"sending up to {limit}."
        )

        sent = failed = 0
        for ep in pending[:limit]:
            kind = "lost" if ep.is_lottery_lost else "won"
            if dry_run:
                self.stdout.write(
                    f"  DRY-RUN {kind} -> {ep.participant.email} "
                    f"(event {ep.event_id}, ep {ep.id})"
                )
                continue

            if ep.is_lottery_lost:
                ok = utils.send_lottery_lost_email(ep.event, ep.participant)
            else:
                ok = utils.send_lottery_won_email(ep.event, ep.participant)

            if ok:
                # Stamp only on success: a failure leaves it NULL so the next
                # run retries it rather than silently dropping the recipient.
                ep.lottery_result_email_sent_at = timezone.now()
                ep.save(update_fields=["lottery_result_email_sent_at"])
                sent += 1
            else:
                failed += 1
                self.stderr.write(
                    f"  FAILED {kind} -> {ep.participant.email} "
                    f"(event {ep.event_id}, ep {ep.id}); will retry next run"
                )

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run: nothing sent."))
            return

        msg = f"[send_lottery_result_emails] sent {sent}"
        if failed:
            msg += f", {failed} failed (left for retry)"
        self.stdout.write(self.style.SUCCESS(msg + "."))
