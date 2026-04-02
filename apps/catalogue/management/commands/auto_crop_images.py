from django.core.management.base import BaseCommand
from oscar.core.loading import get_model


class Command(BaseCommand):
    help = "Run Gemini auto-crop detection on product images and save focal point + zoom."

    def add_arguments(self, parser):
        parser.add_argument(
            "--product",
            type=int,
            metavar="ID",
            help="Only process images for this product ID.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Re-run even if focal point has already been set (non-default values).",
        )

    def handle(self, *args, **options):
        from apps.catalogue.auto_crop import suggest_crop

        ProductImage = get_model("catalogue", "ProductImage")

        qs = ProductImage.objects.all()
        if options["product"]:
            qs = qs.filter(product_id=options["product"])

        if not options["overwrite"]:
            # Skip images that have already been manually or automatically set
            qs = qs.filter(focal_point_x=50, focal_point_y=50, zoom_level=1.0)

        total = qs.count()
        if total == 0:
            self.stdout.write("No images to process.")
            return

        self.stdout.write(f"Processing {total} image(s)…")
        ok = skipped = failed = 0

        for img in qs.iterator():
            try:
                result = suggest_crop(img.original.path)
                ProductImage.objects.filter(pk=img.pk).update(**result)
                self.stdout.write(
                    f"  [{img.pk}] product={img.product_id}  "
                    f"focal=({result['focal_point_x']}%, {result['focal_point_y']}%)  "
                    f"zoom={result['zoom_level']}x"
                )
                ok += 1
            except Exception as e:
                self.stderr.write(f"  [{img.pk}] FAILED: {e}")
                failed += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {ok} updated, {skipped} skipped, {failed} failed."
        ))
