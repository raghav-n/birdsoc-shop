#!/usr/bin/env python
"""
Script to retroactively apply the NTU discount to specified orders.

Usage:
python manage.py shell < scripts/apply_ntu_discount.py

You'll need to modify the ORDER_NUMBERS list with the order numbers you want to process.
"""

import sys
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from oscar.core.loading import get_model
from django.contrib.auth.models import User

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Get models
Order = get_model("order", "Order")
OrderNote = get_model("order", "OrderNote")
OrderDiscount = get_model("order", "OrderDiscount")
Voucher = get_model("voucher", "Voucher")
VoucherApplication = get_model("voucher", "VoucherApplication")
Benefit = get_model("offer", "Benefit")
ConditionalOffer = get_model("offer", "ConditionalOffer")

# Configuration
ORDER_NUMBERS = ["2PA7ZJ", "2WRGR6"]

# Set the NTU discount percentage (e.g., 10%)
NTU_DISCOUNT_PERCENT = 20
NTU_VOUCHER_CODE = "NTU"

# Get or create system user for notes and voucher applications
system_user, _ = User.objects.get_or_create(
    username="system_discount_script",
    defaults={
        "is_staff": True,
        "is_active": False,
        "first_name": "System",
        "last_name": "Script",
    },
)

# Try to get the NTU voucher and its related offer
try:
    ntu_voucher = Voucher.objects.get(code=NTU_VOUCHER_CODE)
    # Get the offer associated with this voucher
    ntu_offer = ntu_voucher.offers.first()
    if not ntu_offer:
        logging.error(f"Voucher '{NTU_VOUCHER_CODE}' has no associated offer")
        sys.exit(1)
except Voucher.DoesNotExist:
    logging.error(f"Voucher with code '{NTU_VOUCHER_CODE}' not found")
    sys.exit(1)

# Keep track of results
successful_orders = []
failed_orders = []

# Process each order
for order_number in ORDER_NUMBERS:
    try:
        with transaction.atomic():
            # Get the order
            try:
                order = Order.objects.get(number=order_number)
            except Order.DoesNotExist:
                logging.warning(f"Order {order_number} not found")
                failed_orders.append((order_number, "Order not found"))
                continue

            # # Check if discount already applied
            # if (VoucherApplication.objects.filter(voucher=ntu_voucher, order=order).exists() or
            #         OrderDiscount.objects.filter(order=order, offer_name__icontains="NTU").exists() or
            #         OrderNote.objects.filter(order=order, message__icontains="NTU").exists()):
            #     logging.info(f"Order {order_number} already has NTU discount applied")
            #     failed_orders.append((order_number, "Discount already applied"))
            #     continue

            # Calculate the discount
            original_total_excl_tax = order.total_excl_tax
            discount_amount = (
                original_total_excl_tax * Decimal(NTU_DISCOUNT_PERCENT) / Decimal(100)
            ).quantize(Decimal("0.01"))

            # Calculate the tax on the discount amount (if applicable)
            tax_ratio = (
                order.total_tax / order.total_excl_tax
                if order.total_excl_tax > 0
                else Decimal("0")
            )
            discount_tax = (discount_amount * tax_ratio).quantize(Decimal("0.01"))
            discount_incl_tax = discount_amount + discount_tax

            # Update order totals
            order.total_incl_tax -= discount_incl_tax
            order.total_excl_tax -= discount_amount

            # Calculate and apply the discount to each line individually
            for line in order.lines.all():
                # Calculate discount for this line proportional to its value relative to total
                line_excl_tax = line.line_price_excl_tax
                if original_total_excl_tax > 0:
                    line_discount = (
                        line_excl_tax / original_total_excl_tax * discount_amount
                    ).quantize(Decimal("0.01"))
                    line_discount_tax = (line_discount * tax_ratio).quantize(
                        Decimal("0.01")
                    )

                    # Update line totals
                    line.line_price_incl_tax -= line_discount + line_discount_tax
                    line.line_price_excl_tax -= line_discount
                    line.save()

            # Save the order
            order.save()

            # Create OrderDiscount record
            OrderDiscount.objects.create(
                order=order,
                category="Voucher",
                offer_id=ntu_offer.id,
                offer_name=f"NTU Student Discount ({NTU_DISCOUNT_PERCENT}%)",
                voucher_id=ntu_voucher.id,
                voucher_code=ntu_voucher.code,
                frequency=1,
                amount=discount_incl_tax,  # Use the tax inclusive amount
            )

            # Create a note about the retroactive discount
            OrderNote.objects.create(
                order=order,
                user=system_user,
                note_type="System",
                message=f"Retroactively applied NTU {NTU_DISCOUNT_PERCENT}% discount "
                f"of ${discount_incl_tax} (incl. tax) on {timezone.now().strftime('%Y-%m-%d')}.",
            )

            # Record the voucher usage
            VoucherApplication.objects.create(
                voucher=ntu_voucher,
                user=system_user,
                order=order,
                # offer=ntu_offer
            )

            logging.info(
                f"Successfully applied {NTU_DISCOUNT_PERCENT}% discount (${discount_incl_tax} incl. tax) to order {order_number}"
            )
            successful_orders.append((order_number, discount_incl_tax))

    except Exception as e:
        logging.error(f"Error processing order {order_number}: {e}")
        failed_orders.append((order_number, str(e)))

# Print summary
print("\n=== DISCOUNT APPLICATION SUMMARY ===")
print(f"Script executed at: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"NTU Discount: {NTU_DISCOUNT_PERCENT}%")
print(f"Total orders processed: {len(ORDER_NUMBERS)}")
print(f"Successful: {len(successful_orders)}")
print(f"Failed: {len(failed_orders)}")

if successful_orders:
    print("\nSuccessfully updated orders:")
    total_discount = Decimal("0.00")
    for order_num, discount in successful_orders:
        print(f" - Order {order_num}: ${discount} discount applied")
        total_discount += discount
    print(f"\nTotal discount amount: ${total_discount}")

if failed_orders:
    print("\nFailed orders:")
    for order_num, reason in failed_orders:
        print(f" - Order {order_num}: {reason}")
