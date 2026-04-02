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
        parser.add_argument(
            "--instructions",
            type=str,
            default="",
            metavar="TEXT",
            help="Extra instructions appended to the Gemini prompt.",
        )
        parser.add_argument(
            "--title-regex",
            type=str,
            default="",
            metavar="REGEX",
            help="Only process images whose product title matches this regex (case-insensitive).",
        )

    def handle(self, *args, **options):
        import re
        from apps.catalogue.auto_crop import suggest_crop

        ProductImage = get_model("catalogue", "ProductImage")

        qs = ProductImage.objects.select_related("product").all()
        if options["product"]:
            qs = qs.filter(product_id=options["product"])

        if options["title_regex"]:
            pattern = re.compile(options["title_regex"], re.IGNORECASE)
            qs = [img for img in qs if img.product and pattern.search(img.product.title or "")]
        else:
            qs = list(qs)

        if not options["overwrite"]:
            qs = [img for img in qs if img.focal_point_x == 50 and img.focal_point_y == 50 and img.zoom_level == 1.0]

        extra = options["instructions"]
        if extra:
            self.stdout.write(f"Extra instructions: {extra}")

        total = len(qs)
        if total == 0:
            self.stdout.write("No images to process.")
            return

        self.stdout.write(f"Processing {total} image(s)…")
        ok = failed = 0

        for img in qs:
            try:
                result = suggest_crop(img.original.path, extra_instructions=extra)
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
            f"\nDone. {ok} updated, {failed} failed."
        ))
