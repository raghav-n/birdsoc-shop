from django.core.management.base import BaseCommand, CommandError
from oscar.core.loading import get_model

from apps.order.utils import (
    OrderDeletionNotAllowed,
    delete_order_and_release_allocations,
)

Order = get_model("order", "Order")


class Command(BaseCommand):
    help = "Delete an uncollected order and release any outstanding stock allocations."

    def add_arguments(self, parser):
        parser.add_argument("order_number", help="Order number to delete")

    def handle(self, *args, **options):
        order_number = str(options["order_number"])
        try:
            order = Order._default_manager.get(number=order_number)
        except Order.DoesNotExist as exc:
            raise CommandError(f"Order {order_number} does not exist.") from exc

        try:
            allocations_released, deleted_count = delete_order_and_release_allocations(
                order
            )
        except OrderDeletionNotAllowed as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted order {order_number}. Released {allocations_released} allocation(s). "
                f"Deleted {deleted_count} row(s)."
            )
        )
