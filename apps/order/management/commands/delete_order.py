from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from oscar.core.loading import get_model


Order = get_model("order", "Order")


class Command(BaseCommand):
    help = "Delete an uncollected order and release any outstanding stock allocations."

    def add_arguments(self, parser):
        parser.add_argument("order_number", help="Order number to delete")

    @transaction.atomic
    def handle(self, *args, **options):
        order_number = str(options["order_number"])
        try:
            order = (
                Order._default_manager.select_for_update()
                .prefetch_related("lines__stockrecord")
                .get(number=order_number)
            )
        except Order.DoesNotExist as exc:
            raise CommandError(f"Order {order_number} does not exist.") from exc

        if order.status == settings.COLLECTED_STATUS:
            raise CommandError(
                f"Order {order_number} is already {settings.COLLECTED_STATUS!r} and cannot be deleted."
            )

        allocations_released = 0
        for line in order.lines.select_related("stockrecord").all():
            if line.can_track_allocations and line.num_allocated:
                allocations_released += line.num_allocated
                line.cancel_allocation(line.num_allocated)

        deleted_count, _ = order.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted order {order_number}. Released {allocations_released} allocation(s). "
                f"Deleted {deleted_count} row(s)."
            )
        )
