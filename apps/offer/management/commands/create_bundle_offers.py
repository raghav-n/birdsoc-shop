import json
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from oscar.core.loading import get_model

Benefit = get_model("offer", "Benefit")
Condition = get_model("offer", "Condition")
ConditionalOffer = get_model("offer", "ConditionalOffer")
Range = get_model("offer", "Range")
StockRecord = get_model("partner", "StockRecord")

VALID_CONDITION_TYPES = {"Count", "Coverage", "Value"}
VALID_BENEFIT_TYPES = {
    "Fixed price", "Percentage", "Absolute", "Multibuy", "Fixed",
}


class Command(BaseCommand):
    help = "Create bundle discount offers from a JSON config file"

    def add_arguments(self, parser):
        parser.add_argument(
            "config",
            help="Path to JSON file defining bundles",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Delete existing offers with matching names before creating",
        )

    def handle(self, *args, **options):
        try:
            with open(options["config"]) as f:
                bundles = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            raise CommandError(f"Could not read config file: {e}")

        if not isinstance(bundles, list):
            raise CommandError("Config file must contain a JSON array of bundles")

        for i, bundle in enumerate(bundles):
            self._validate(bundle, i)

        if options["delete"]:
            names = [b["name"] for b in bundles]
            deleted, _ = ConditionalOffer.objects.filter(name__in=names).delete()
            self.stdout.write(f"Deleted {deleted} existing bundle offer object(s)")

        for bundle in bundles:
            self._create_bundle(bundle)

    def _validate(self, bundle, index):
        required = {"name", "skus", "condition_type", "condition_value", "benefit_type", "benefit_value"}
        missing = required - bundle.keys()
        if missing:
            raise CommandError(f"Bundle {index}: missing fields {missing}")

        if bundle["condition_type"] not in VALID_CONDITION_TYPES:
            raise CommandError(
                f"Bundle {index}: condition_type must be one of {VALID_CONDITION_TYPES}"
            )

        if bundle["benefit_type"] not in VALID_BENEFIT_TYPES:
            raise CommandError(
                f"Bundle {index}: benefit_type must be one of {VALID_BENEFIT_TYPES}"
            )

    def _create_bundle(self, bundle):
        stock_records = StockRecord.objects.filter(
            partner_sku__in=bundle["skus"]
        ).select_related("product")

        found_skus = set(stock_records.values_list("partner_sku", flat=True))
        missing = set(bundle["skus"]) - found_skus
        if missing:
            self.stderr.write(
                self.style.WARNING(
                    f"  Skipping '{bundle['name']}': missing SKUs {missing}"
                )
            )
            return

        products = [sr.product for sr in stock_records]

        # Create range
        prod_range, _ = Range.objects.get_or_create(
            name=f"{bundle['name']} Range",
            defaults={"description": bundle.get("description", "")},
        )
        prod_range.included_products.set(products)

        # Create condition
        condition, _ = Condition.objects.get_or_create(
            range=prod_range,
            type=bundle["condition_type"],
            value=bundle["condition_value"],
        )

        # Create benefit
        benefit, _ = Benefit.objects.get_or_create(
            range=prod_range,
            type=bundle["benefit_type"],
            value=Decimal(str(bundle["benefit_value"])),
        )

        # Create or update offer
        offer, created = ConditionalOffer.objects.update_or_create(
            name=bundle["name"],
            defaults={
                "offer_type": ConditionalOffer.SITE,
                "description": bundle.get("description", ""),
                "condition": condition,
                "benefit": benefit,
                "exclusive": bundle.get("exclusive", False),
            },
        )

        verb = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(f"  {verb} offer: {bundle['name']}")
        )
