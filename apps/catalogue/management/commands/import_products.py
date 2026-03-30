import csv
import os
import shutil

from django.core.files.images import ImageFile
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

from oscar.apps.catalogue.models import (
    Category,
    Product,
    ProductClass,
    ProductImage,
    ProductAttribute,
    ProductAttributeValue,
)
from oscar.apps.partner.models import Partner, StockRecord


class Command(BaseCommand):
    help = (
        "Import products from a CSV file into the Oscar catalogue. "
        "Supports standalone, parent, and child product structures, "
        "images, stock records, and product attributes."
    )

    def add_arguments(self, parser):
        parser.add_argument("csv_file", help="Path to the CSV file to import.")
        parser.add_argument(
            "--images-dir",
            help="Directory containing product images. "
            "Image filenames in the CSV are resolved relative to this directory.",
            default=None,
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate the CSV without writing to the database.",
        )
        parser.add_argument(
            "--update",
            action="store_true",
            help="Update existing products matched by partner_sku instead of skipping them.",
        )

    def handle(self, *args, **options):
        csv_path = options["csv_file"]
        images_dir = options.get("images_dir")
        dry_run = options["dry_run"]
        update = options["update"]

        if not os.path.isfile(csv_path):
            raise CommandError(f"CSV file not found: {csv_path}")

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not rows:
            raise CommandError("CSV file is empty.")

        self.stdout.write(f"Found {len(rows)} rows in {csv_path}")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no changes will be made."))

        # Detect attribute columns (anything beyond the known columns)
        known_cols = {
            "product_class", "category", "upc", "title", "description",
            "partner_name", "partner_sku", "price", "num_in_stock",
            "images", "structure", "parent",
        }
        fieldnames = reader.fieldnames or []
        attr_cols = [c for c in fieldnames if c not in known_cols and c.strip()]

        stats = {"created": 0, "updated": 0, "skipped": 0, "images": 0, "errors": 0}

        # First pass: create/update parent and standalone products
        # Second pass: create/update child products (so parents exist)
        parents_first = sorted(rows, key=lambda r: 0 if r.get("structure", "standalone") != "child" else 1)

        for i, row in enumerate(parents_first, 1):
            try:
                self._import_row(row, attr_cols, images_dir, dry_run, update, stats)
            except Exception as e:
                stats["errors"] += 1
                self.stderr.write(
                    self.style.ERROR(f"Row {i} ({row.get('title', '?')}): {e}")
                )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Created: {stats['created']}, Updated: {stats['updated']}, "
            f"Skipped: {stats['skipped']}, Images: {stats['images']}, Errors: {stats['errors']}"
        ))

    def _import_row(self, row, attr_cols, images_dir, dry_run, update, stats):
        title = row.get("title", "").strip()
        if not title:
            stats["skipped"] += 1
            return

        structure = row.get("structure", "standalone").strip() or "standalone"
        product_class_name = row.get("product_class", "").strip()
        category_name = row.get("category", "").strip()
        description = row.get("description", "").strip()
        upc = row.get("upc", "").strip() or None
        partner_name = row.get("partner_name", "").strip()
        partner_sku = row.get("partner_sku", "").strip()
        price = row.get("price", "").strip()
        num_in_stock = row.get("num_in_stock", "").strip()
        images_str = row.get("images", "").strip()
        parent_title = row.get("parent", "").strip()

        if dry_run:
            self.stdout.write(f"  [DRY RUN] {structure}: {title}")
            stats["created"] += 1
            return

        # Check for existing product by SKU
        existing = None
        if partner_sku:
            try:
                sr = StockRecord.objects.get(partner_sku=partner_sku)
                existing = sr.product
            except StockRecord.DoesNotExist:
                pass

        if existing and not update:
            stats["skipped"] += 1
            self.stdout.write(f"  Skipped (exists): {title}")
            return

        # Product class (required for standalone/parent)
        product_class = None
        if product_class_name and structure != "child":
            product_class, _ = ProductClass.objects.get_or_create(name=product_class_name)

        # Parent lookup for child products
        parent_product = None
        if structure == "child":
            if not parent_title:
                raise CommandError(f"Child product '{title}' has no parent specified.")
            try:
                parent_product = Product.objects.get(title=parent_title, structure="parent")
            except Product.DoesNotExist:
                raise CommandError(
                    f"Parent product '{parent_title}' not found for child '{title}'."
                )
            product_class = parent_product.product_class

        # Create or update product
        if existing and update:
            product = existing
            product.title = title
            product.description = description
            product.structure = structure
            if product_class:
                product.product_class = product_class
            if parent_product:
                product.parent = parent_product
            if upc:
                product.upc = upc
            product.save()
            stats["updated"] += 1
            self.stdout.write(f"  Updated: {title}")
        else:
            product = Product.objects.create(
                title=title,
                slug=slugify(title),
                description=description,
                structure=structure,
                product_class=product_class if structure != "child" else None,
                parent=parent_product,
                upc=upc,
                is_public=True,
            )
            stats["created"] += 1
            self.stdout.write(f"  Created: {title}")

        # Category
        if category_name and structure != "child":
            try:
                category = Category.objects.get(name=category_name)
            except Category.DoesNotExist:
                category = Category.add_root(name=category_name)
            product.categories.add(category)

        # Stock record
        if partner_name and partner_sku and price:
            partner, _ = Partner.objects.get_or_create(name=partner_name)
            sr_defaults = {"price": price}
            if num_in_stock:
                sr_defaults["num_in_stock"] = int(num_in_stock)
            StockRecord.objects.update_or_create(
                product=product,
                partner=partner,
                partner_sku=partner_sku,
                defaults=sr_defaults,
            )

        # Product attributes (extra columns like size, material, etc.)
        for attr_name in attr_cols:
            attr_value = row.get(attr_name, "").strip()
            if not attr_value:
                continue
            # Ensure attribute exists on the product class
            pc = product_class or (parent_product.product_class if parent_product else None)
            if not pc:
                continue
            attr, _ = ProductAttribute.objects.get_or_create(
                product_class=pc,
                name=attr_name.capitalize(),
                defaults={"code": slugify(attr_name), "type": ProductAttribute.TEXT},
            )
            product.attribute_values.update_or_create(
                attribute=attr,
                defaults={"value_text": attr_value},
            )

        # Images
        if images_str and images_dir:
            filenames = [f.strip() for f in images_str.split(";") if f.strip()]
            for idx, filename in enumerate(filenames):
                img_path = os.path.join(images_dir, filename)
                if not os.path.isfile(img_path):
                    self.stderr.write(
                        self.style.WARNING(f"  Image not found: {img_path}")
                    )
                    continue
                # Skip if image with same original name already exists
                if ProductImage.objects.filter(
                    product=product, original__endswith=filename
                ).exists():
                    continue
                with open(img_path, "rb") as img_file:
                    pi = ProductImage(product=product, display_order=idx)
                    pi.original.save(filename, ImageFile(img_file))
                    pi.save()
                    stats["images"] += 1
