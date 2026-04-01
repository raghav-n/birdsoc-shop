import json
import pandas as pd
from datetime import date, timedelta
from io import BytesIO

from django import forms
from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.utils.decorators import method_decorator
from django.utils.timezone import localtime
from django.views import View
from oscar.core.loading import get_model, get_class
from django.db import models
from django.views.generic import TemplateView, FormView
from django.shortcuts import redirect
from django.contrib import messages
from django.utils.crypto import get_random_string
from django.db import transaction
from django.utils import timezone
from django.urls import reverse
from oscar.apps.voucher.models import Voucher
from decimal import Decimal
from django.db.models import Count, Sum

from oscar.apps.dashboard.orders.views import (
    OrderStatsView as BaseOrderStatsView,
    queryset_orders_for_user,
)

from apps.checkout.models import PendingCheckout
from apps.order.models import SalesPeriod

Product = get_model("catalogue", "Product")
Line = get_model("basket", "Line")
OrderLine = get_model("order", "Line")
Order = get_model("order", "Order")
Basket = get_model("basket", "Basket")
Selector = get_class("partner.strategy", "Selector")
OrderTotalCalculator = get_class("checkout.calculators", "OrderTotalCalculator")
Source = get_model("payment", "Source")
DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
ShippingAddress = get_model("order", "ShippingAddress")
Country = get_model("address", "Country")
PaymentEvent = get_model("order", "PaymentEvent")
PaymentEventType = get_model("order", "PaymentEventType")
PaymentEventQuantity = get_model("order", "PaymentEventQuantity")
SourceType = get_model("payment", "SourceType")
OrderCreator = get_class("order.utils", "OrderCreator")
ConditionalOffer = get_model("offer", "ConditionalOffer")
Applicator = get_class("offer.applicator", "Applicator")
User = get_model("auth", "User")


@method_decorator(staff_member_required, name="dispatch")
class OrderLookupView(View):
    template_name = "oscar/dashboard/orders/order_lookup.html"

    def get(self, request):
        return render(request, self.template_name)

    def post(self, request):
        Order = get_model("order", "Order")

        order_number = json.loads(request.body.decode())["order_number"]

        try:
            order = Order._default_manager.get(number=order_number)
        except Order.DoesNotExist:
            return JsonResponse({"success": False, "message": "No matching order"})

        items = list(order.lines.values("title", "quantity"))

        return JsonResponse(
            {
                "success": True,
                "customer_name": order.user.get_full_name(),
                "status": order.status,
                "items": items,
            }
        )


@method_decorator(staff_member_required, name="dispatch")
class OrderCollectionView(View):
    def post(self, request):
        Order = get_model("order", "Order")

        order_number = json.loads(request.body.decode())["order_number"]

        try:
            order = Order._default_manager.get(number=order_number)
        except Order.DoesNotExist:
            return JsonResponse({"success": False, "message": "No matching order"})

        try:
            order.set_status(settings.COLLECTED_STATUS)
        except Exception as e:
            return JsonResponse(
                {"success": False, "message": f"{e.__class__.__name__}: {e}"}
            )

        return JsonResponse({"success": True})


class OrderExportForm(forms.Form):
    start_date = forms.DateField(
        required=True, widget=forms.DateInput(attrs={"type": "date"})
    )
    end_date = forms.DateField(
        required=True, widget=forms.DateInput(attrs={"type": "date"})
    )


class OrderSummaryView(View):
    def get(self, request):
        form = OrderExportForm()
        return render(
            request, "oscar/dashboard/orders/order_summary.html", {"form": form}
        )

    def post(self, request):
        form = OrderExportForm(request.POST)
        if form.is_valid():
            start_date = form.cleaned_data["start_date"]
            end_date = form.cleaned_data["end_date"]
            return self.export_to_excel(start_date, end_date)
        return render(
            request, "oscar/dashboard/orders/order_summary.html", {"form": form}
        )

    def export_to_excel(self, start_date: date, end_date: date):
        Order = get_model("order", "Order")
        Line = get_model("order", "Line")

        orders = Order.objects.filter(date_placed__range=(start_date, end_date))
        order_info = []

        for order in orders:
            customer_name = order.user.get_full_name() if order.user else "Guest"
            reference_number = order.number
            order_status = order.status
            date_placed = localtime(order.date_placed).strftime("%Y-%m-%d %H:%M:%S")
            items = Line.objects.filter(order=order)
            units_of_each_item = ", ".join(
                f"{item.product.title}: {item.quantity}" for item in items
            )
            total_cost = order.total_incl_tax_with_donation - order.donation_amount
            donation_amount = order.donation_amount
            total_with_donation = order.total_incl_tax_with_donation

            order_info.append(
                {
                    "reference_number": reference_number,
                    "customer_name": customer_name,
                    "date_placed": date_placed,
                    "order_status": order_status,
                    "units_of_each_item": units_of_each_item,
                    "total_cost": total_cost,
                    "donation_amount": donation_amount,
                    "total_with_donation": total_with_donation,
                }
            )

        df = pd.DataFrame(order_info)
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="orders_{start_date}_to_{end_date}.xlsx"'
        )
        df.to_excel(response, index=False)

        return response


class OnsitePurchaseView(TemplateView):
    template_name = "oscar/dashboard/orders/onsite_purchase.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)

        # Get all parent products and products without variants (standalones)
        # Filter out products with no stock or price
        products = (
            Product.objects.filter(is_public=True)
            .filter(
                # Include standalone products or parent products that have children
                models.Q(structure="standalone") | models.Q(structure="parent")
            )
            .distinct()
        )

        # Filter further to ensure they have stock records and are purchasable
        available_products = []

        for product in products:
            # For standalone products, check if they have stock records
            if product.structure == "standalone":
                if product.has_stockrecords and product.stockrecords.exists():
                    # Check stock level
                    stockrecord = product.stockrecords.first()
                    if (
                        stockrecord.num_in_stock is not None
                        and stockrecord.num_in_stock > 0
                    ):
                        strategy = Selector().strategy()
                        info = strategy.fetch_for_product(product)
                        available_products.append([product, info])

            # For parent products, check if any of their children have stock records
            elif product.structure == "parent":
                children = product.children.filter(is_public=True)
                has_available_children = False

                for child in children:
                    if child.has_stockrecords and child.stockrecords.exists():
                        stockrecord = child.stockrecords.first()
                        if (
                            stockrecord.num_in_stock is not None
                            and stockrecord.num_in_stock > 0
                        ):
                            has_available_children = True
                            break

                if has_available_children:
                    available_products.append([product, None])

        # Sort products in the required order: keychains, stickers, hat, pin
        def get_product_sort_key(product_info):
            product = (
                product_info[0] if isinstance(product_info, list) else product_info
            )
            title = product.title.lower()

            # Define priorities (lower number = higher priority)
            if "keychain" in title:
                return 1
            elif "sticker" in title:
                return 2
            elif "hat" in title:
                return 3
            elif "pin" in title:
                return 4
            else:
                return 5  # All other products last

        # Sort the products by the custom ordering
        available_products.sort(key=get_product_sort_key)

        ctx["products"] = available_products

        # Generate a unique 6-digit alphanumeric order number starting with 2
        # Attempt up to 10 times to generate a unique order number
        max_attempts = 10
        attempts = 0
        order_number = None

        while attempts < max_attempts:
            # Generate a new candidate order number
            candidate_number = "2" + get_random_string(
                length=5, allowed_chars="0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
            )

            # Check if this number is already used
            if not Order.objects.filter(number=candidate_number).exists():
                order_number = candidate_number
                break

            attempts += 1

        # If all attempts failed, use timestamp-based fallback
        if not order_number:
            timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
            order_number = f"2{timestamp[-6:]}"

        ctx["order_number"] = order_number
        ctx["reference_id"] = f"{settings.ORDER_PREFIX}{order_number}"
        ctx["settings"] = settings  # Add settings to context for template access

        return ctx

    def post(self, request, *args, **kwargs):
        from django.contrib.auth.models import User
        from oscar.apps.partner.models import StockRecord
        from oscar.core.loading import get_class

        data = request.POST
        product_quantities = {}
        order_number = data.get("order_number")  # Get the order number from the form
        voucher_code = data.get("voucher_code", "")
        is_cash_purchase = data.get("cash_purchase", "false").lower() == "true"

        # Get selected product quantities
        for key, value in data.items():
            if key.startswith("quantity_") and value and int(value) > 0:
                product_id = key.replace("quantity_", "")
                product_quantities[product_id] = int(value)

        if not product_quantities:
            messages.error(request, "Please select at least one product.")
            return self.get(request, *args, **kwargs)

        # Create a basket with the selected products
        with transaction.atomic():
            # Create or get a guest user for the order
            guest_user, _created = User.objects.get_or_create(
                username=f"guest_{timezone.now().strftime('%Y%m%d%H%M%S')}",
                defaults={
                    "is_active": False,
                    "first_name": "Onsite",
                    "last_name": "Customer",
                },
            )

            # Create a new basket
            basket = Basket.objects.create(owner=guest_user)
            basket.strategy = Selector().strategy(request=request)

            # Add products to basket and track stock records for later update
            stock_updates = []
            for product_id, quantity in product_quantities.items():
                product = Product.objects.get(id=product_id)
                stockrecord = product.stockrecords.first()
                if stockrecord:
                    # Check if we have enough stock
                    if (
                        stockrecord.num_in_stock is not None
                        and stockrecord.num_in_stock < quantity
                    ):
                        messages.error(
                            request,
                            f"Not enough stock for {product.title}. Available: {stockrecord.num_in_stock}, Requested: {quantity}",
                        )
                        return self.get(request, *args, **kwargs)

                    # Track for later update
                    stock_updates.append((stockrecord, quantity))

                basket.add_product(product, quantity=quantity)

            # Apply voucher if one was used and not cash purchase
            voucher = None
            if voucher_code and not is_cash_purchase:
                try:
                    voucher = Voucher.objects.get(code=voucher_code)
                    # Add voucher to basket to apply the discount
                    basket.vouchers.add(voucher)

                    # Apply the offers to the basket (including voucher offers)
                    applicator = Applicator()
                    applicator.apply(basket, request.user, request)
                except Voucher.DoesNotExist:
                    voucher = None

            # Get the basket total AFTER applying vouchers/offers (or without for cash)
            total_incl_tax = basket.total_incl_tax

            # If payment was confirmed (from the form)
            if "confirm_order" in data:
                shipping_method = DynamicShippingMethod.objects.get(code="ONSITE")

                # For non-cash purchases, apply offers and discounts
                if not is_cash_purchase:
                    # First, apply all available offers to the basket
                    # This includes both site offers and any voucher
                    applicator = Applicator()
                    applicator.apply(basket, request.user, request)

                # Get the discount amount for reference
                original_total = basket.total_excl_tax_excl_discounts
                discounted_total = basket.total_excl_tax
                total_discount = original_total - discounted_total

                # Store offer applications for later use
                offer_applications = basket.offer_applications

                # Calculate the order total with all discounts applied
                order_total = OrderTotalCalculator().calculate(
                    basket, shipping_charge=shipping_method.calculate(basket)
                )

                # Create the order with the discounted total
                order_creator = OrderCreator()
                order = order_creator.place_order(
                    basket=basket,
                    total=order_total,  # This now includes all discounts
                    shipping_method=shipping_method,
                    shipping_charge=shipping_method.calculate(basket),
                    user=guest_user,
                    order_number=order_number,
                    status=settings.COLLECTED_STATUS,
                )

                # Record voucher usage against the order if used
                if voucher and not is_cash_purchase:
                    voucher.record_usage(order, request.user)

                    # Add a note about the voucher discount
                    voucher_discount = Decimal("0.00")
                    for discount in offer_applications.voucher_discounts:
                        voucher_discount += discount["discount"]

                    if voucher_discount > 0:
                        order.notes.create(
                            user=request.user,
                            message=f"Voucher {voucher.code} applied for a discount of ${voucher_discount:.2f}",
                            note_type="System",
                        )

                # Record any site offer discounts (only for non-cash purchases)
                if not is_cash_purchase:
                    site_offer_discount = Decimal("0.00")
                    site_offer_names = []
                    for discount in offer_applications.offer_discounts:
                        site_offer_discount += discount["discount"]
                        site_offer_names.append(discount["name"])

                    if site_offer_discount > 0:
                        offer_names = ", ".join(site_offer_names)
                        order.notes.create(
                            user=request.user,
                            message=f"Site offers applied: {offer_names} for a discount of ${site_offer_discount:.2f}",
                            note_type="System",
                        )

                # Create payment source and event with the TOTAL discounted amount
                paynow_reference = f"{settings.ORDER_PREFIX}{order_number}"

                # Set source type based on purchase type
                if is_cash_purchase:
                    source_type, _ = SourceType.objects.get_or_create(name="cash")
                else:
                    source_type, _ = SourceType.objects.get_or_create(name="PayNow")

                source = Source.objects.create(
                    source_type=source_type,
                    amount_allocated=order_total.incl_tax,
                    amount_debited=order_total.incl_tax,
                    reference=paynow_reference,
                    order=order,
                )

                # Create payment event with the DISCOUNTED total
                if is_cash_purchase:
                    event_type, _ = PaymentEventType.objects.get_or_create(
                        name="cash-payment"
                    )
                else:
                    event_type = PaymentEventType.objects.get(name="paynow-processing")

                event = PaymentEvent.objects.create(
                    event_type=event_type,
                    amount=order_total.incl_tax,  # Use the discounted total
                    reference=paynow_reference,
                    order=order,
                )

                # Link the payment event to the order lines
                for line in order.lines.all():
                    PaymentEventQuantity.objects.create(
                        event=event, line=line, quantity=line.quantity
                    )

                # Update stock levels after successful order creation
                for stockrecord, quantity in stock_updates:
                    # Reduce stock count
                    if stockrecord.num_in_stock is not None:
                        stockrecord.num_in_stock -= quantity
                        stockrecord.save()

                # Add a success message that mentions any discounts and payment type
                payment_type = "cash" if is_cash_purchase else "PayNow"
                success_message = f"Order {paynow_reference} created successfully ({payment_type} payment). Stock levels updated."
                if total_discount > 0 and not is_cash_purchase:
                    success_message += f" Discount of ${total_discount:.2f} applied."

                messages.success(request, success_message)
                return redirect("dashboard:order-detail", number=order.number)

            # If just generating QR code (not applicable for cash purchases)
            return self.render_to_response(
                {
                    "products": Product.objects.filter(is_public=True)
                    .filter(
                        # Include standalone products or parent products that have children
                        models.Q(structure="standalone") | models.Q(structure="parent")
                    )
                    .distinct(),
                    "selected_products": product_quantities,
                    "total_incl_tax": total_incl_tax,  # This now includes any discounts
                    "order_number": order_number,  # Pass the order number back to the template
                    "reference_id": data.get("reference_id"),
                    "settings": settings,
                    "show_payment": True,
                    "voucher_code": voucher_code,
                    "original_total": getattr(
                        basket, "total_excl_tax_excl_discounts", total_incl_tax
                    ),
                    "discount_amount": (
                        getattr(basket, "total_excl_tax_excl_discounts", total_incl_tax)
                        - total_incl_tax
                        if voucher
                        else 0
                    ),
                }
            )


class VoucherCheckView(View):
    """View to validate vouchers via AJAX for the onsite purchase page"""

    @method_decorator(staff_member_required)
    def post(self, request):
        code = request.POST.get("voucher", "")

        # Get selected products and quantities
        products = {}
        for key, value in request.POST.items():
            if key.startswith("product_") and value:
                # Format: product_ID
                product_id = key.replace("product_", "")
                quantity = int(value)
                if quantity > 0:
                    products[product_id] = quantity

        # If no product IDs are provided directly, try to parse a JSON array
        if not products and request.POST.get("products"):
            try:
                import json

                products_data = json.loads(request.POST.get("products"))
                for item in products_data:
                    products[str(item["id"])] = int(item["quantity"])
            except (ValueError, KeyError, TypeError) as e:
                return JsonResponse(
                    {"valid": False, "message": f"Invalid product data: {str(e)}"}
                )

        try:
            voucher = Voucher.objects.get(code=code)
        except Voucher.DoesNotExist:
            return JsonResponse({"valid": False, "message": "Voucher code not found"})

        # Create a real basket with the selected products
        from django.contrib.auth.models import AnonymousUser
        from oscar.apps.basket.models import Basket

        basket = Basket()
        # use the current user as the basket owner
        basket.owner = request.user

        # Add strategy to the basket
        strategy = Selector().strategy(request=request)
        basket.strategy = strategy

        # Add each selected product to the basket
        for product_id, quantity in products.items():
            try:
                product = Product.objects.get(id=product_id)
                basket.add_product(product, quantity=quantity)
            except Product.DoesNotExist:
                return JsonResponse(
                    {"valid": False, "message": f"Product {product_id} not found"}
                )
            except Exception as e:
                return JsonResponse(
                    {
                        "valid": False,
                        "message": f"Error adding product {product_id}: {str(e)}",
                    }
                )

        # If we don't have any items in the basket, return error
        if not basket.num_lines:
            return JsonResponse(
                {"valid": False, "message": "Please select at least one product"}
            )

        # Check if voucher is available for this basket
        is_available, message = voucher.is_available_for_basket(basket=basket)
        if not is_available:
            return JsonResponse(
                {
                    "valid": False,
                    "message": message
                    or "Voucher cannot be applied to selected products",
                }
            )

        # Store original basket total before applying voucher
        original_total = basket.total_excl_tax

        try:
            # Apply the voucher to the basket
            basket.vouchers.add(voucher)

            # Create a fresh applicator to apply all offers including the voucher
            applicator = Applicator()
            applicator.apply_offers(basket, voucher.offers.all())

            # Get the basket total after applying the voucher
            discounted_total = basket.total_excl_tax

            # Calculate the actual discount amount
            discount_amount = original_total - discounted_total

            # Log details for debugging
            print(
                f"Voucher check - Original: ${original_total}, After voucher: ${discounted_total}, Discount: ${discount_amount}"
            )
            print(f"Voucher offers applied: {[o.id for o in voucher.offers.all()]}")

            # Ensure we have a positive discount
            if discount_amount <= 0:
                return JsonResponse(
                    {
                        "valid": False,
                        "message": "This voucher does not provide any discount for the selected products",
                    }
                )

            # Get benefit description for display
            benefit_desc = voucher.benefit.description or "Discount applied"

            return JsonResponse(
                {
                    "valid": True,
                    "message": f"Voucher applied: {benefit_desc}",
                    "discount": float(discount_amount),
                    "new_total": float(discounted_total),
                    "original_total": float(original_total),
                }
            )
        except Exception as e:
            import traceback

            print(f"Error applying voucher: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse(
                {"valid": False, "message": f"Error applying voucher: {str(e)}"}
            )


class SiteOffersView(View):
    """View to calculate and apply site offers automatically"""

    def _condition_is_satisfied(self, condition, offer, basket):
        """
        Determines whether a given basket meets this condition
        """
        num_matches = 0
        for line in basket.all_lines():
            if condition.can_apply_condition(line):
                num_matches += line.quantity_without_offer_discount(offer)
            if num_matches >= condition.value:
                return True
        return False

    def _get_applicable_offers(self, basket, user):
        applicable_offers = []
        offers = ConditionalOffer.active.all().filter(offer_type="Site")

        for offer in offers:
            if not offer.is_available(user=user):
                continue

            if self._condition_is_satisfied(offer.condition, offer, basket):
                applicable_offers.append(offer)

        return applicable_offers

    @method_decorator(staff_member_required)
    def post(self, request):
        # Parse product data
        products_data = []
        voucher_code = request.POST.get("voucher", "")

        try:
            products_data = json.loads(request.POST.get("products", "[]"))
        except json.JSONDecodeError:
            return JsonResponse(
                {"site_offers_applied": False, "message": "Invalid product data format"}
            )

        # If no products, return empty result
        if not products_data:
            return JsonResponse(
                {"site_offers_applied": False, "message": "No products provided"}
            )

        # Create a temporary basket to apply offers
        from django.contrib.auth.models import AnonymousUser
        from oscar.apps.basket.models import Basket

        user = AnonymousUser()
        basket = Basket()

        # Add strategy to the basket
        strategy = Selector().strategy(request=request)
        basket.strategy = strategy

        # Add each product to the basket
        for product_data in products_data:
            try:
                product_id = product_data["id"]
                quantity = int(product_data["quantity"])

                if quantity <= 0:
                    continue

                product = Product.objects.get(id=product_id)
                basket.add_product(product, quantity=quantity)
            except (KeyError, ValueError, Product.DoesNotExist):
                continue

        # If basket is empty, return no offers
        if not basket.num_lines:
            return JsonResponse(
                {"site_offers_applied": False, "message": "No valid products in basket"}
            )

        # Store the original total before applying any offers
        original_total = basket.total_excl_tax

        # Apply site offers (excluding vouchers)
        site_applicator = Applicator()
        site_offers = self._get_applicable_offers(basket, user)
        site_applicator.apply_offers(basket, site_offers)

        # Calculate discount from site offers only
        total_after_site_offers = basket.total_excl_tax
        site_offer_discount = original_total - total_after_site_offers

        # Apply voucher if provided
        voucher_discount = Decimal("0.00")
        final_total = total_after_site_offers

        if voucher_code:
            try:
                # Create a separate basket for voucher calculation
                voucher_basket = Basket()
                voucher_basket.strategy = strategy

                # Copy the same products to voucher basket
                for line in basket.all_lines():
                    voucher_basket.add_product(line.product, quantity=line.quantity)

                # Apply site offers first to simulate the same state
                site_applicator = Applicator()
                site_applicator.apply_offers(voucher_basket, site_offers)

                # Get voucher and check if it's valid
                voucher = Voucher.objects.get(code=voucher_code)
                is_available, _ = voucher.is_available_for_basket(voucher_basket)

                if is_available:
                    # Apply the voucher
                    voucher_basket.vouchers.add(voucher)

                    # Apply voucher offers
                    voucher_applicator = Applicator()
                    voucher_applicator.apply(voucher_basket, user, request)

                    # Calculate voucher discount as the difference between baskets
                    total_after_all_offers = voucher_basket.total_excl_tax
                    voucher_discount = total_after_site_offers - total_after_all_offers

                    # Set final total after all discounts
                    final_total = total_after_all_offers

                    # Log for debugging
                    print(
                        f"Site offers endpoint - Original: ${original_total}, After site offers: ${total_after_site_offers}, After voucher: ${final_total}"
                    )
                    print(
                        f"Site discount: ${site_offer_discount}, Voucher discount: ${voucher_discount}"
                    )
            except Voucher.DoesNotExist:
                # Voucher not found, ignore
                pass
            except Exception as e:
                import traceback

                print(f"Error calculating voucher discount: {str(e)}")
                print(traceback.format_exc())

        # Generate a description of applied offers
        site_offers_description = "Automatic discount"
        if basket.offer_applications.offer_discounts:
            offer_names = [
                discount["name"]
                for discount in basket.offer_applications.offer_discounts
            ]
            site_offers_description = ", ".join(offer_names)

        # Ensure all values are positive and final total is not negative
        site_offer_discount = max(Decimal("0.00"), site_offer_discount)
        voucher_discount = max(Decimal("0.00"), voucher_discount)
        final_total = max(Decimal("0.00"), final_total)

        # Return the calculated values
        return JsonResponse(
            {
                "site_offers_applied": site_offer_discount > Decimal("0.00"),
                "site_offers_discount": float(site_offer_discount),
                "site_offers_description": site_offers_description,
                "voucher_discount": float(voucher_discount),
                "final_total": float(final_total),
                "original_total": float(original_total),
            }
        )


class OrderStatsView(BaseOrderStatsView):
    template_name = "oscar/dashboard/orders/statistics.html"

    def get_stats(self, filters):
        orders = queryset_orders_for_user(self.request.user).filter(**filters)

        # Collect number of units sold of each product
        product_sales = (
            OrderLine.objects.filter(order__in=orders)
            .values("product__title", "product__id")
            .annotate(
                total_quantity=Sum("quantity"), total_revenue=Sum("line_price_incl_tax")
            )
            .order_by("-total_quantity")
        )

        # Format product sales data for easier consumption
        product_sales_list = []
        for item in product_sales:
            product_sales_list.append(
                {
                    "product_id": item["product__id"],
                    "product_title": item["product__title"],
                    "units_sold": item["total_quantity"],
                    "revenue": item["total_revenue"] or Decimal("0.00"),
                }
            )

        print(f"Product sales data: {product_sales_list}")

        stats = {
            "total_orders": orders.count(),
            "total_lines": OrderLine.objects.filter(order__in=orders).count(),
            "total_revenue": orders.aggregate(Sum("total_incl_tax"))[
                "total_incl_tax__sum"
            ]
            or Decimal("0.00"),
            "order_status_breakdown": orders.order_by("status")
            .values("status")
            .annotate(freq=Count("id")),
            "product_sales": product_sales_list,
        }
        return stats


@method_decorator(staff_member_required, name="dispatch")
class SalesReportView(View):
    template_name = "oscar/dashboard/orders/sales_report.html"

    def get(self, request):
        form = OrderExportForm()
        periods = SalesPeriod.objects.all()
        return render(request, self.template_name, {
            "form": form,
            "periods": periods,
        })

    def post(self, request):
        action = request.POST.get("action", "")
        if action == "detect":
            return self.handle_detect(request)
        elif action == "save":
            return self.handle_save(request)
        elif action == "export":
            return self.handle_export(request)
        return redirect("dashboard:sales-report")

    def handle_detect(self, request):
        form = OrderExportForm(request.POST)
        if not form.is_valid():
            periods = SalesPeriod.objects.all()
            return render(request, self.template_name, {
                "form": form,
                "periods": periods,
            })

        start_date = form.cleaned_data["start_date"]
        end_date = form.cleaned_data["end_date"]

        orders = Order.objects.filter(
            date_placed__range=(start_date, end_date),
        ).exclude(status="Cancelled")

        detected = self.detect_periods(orders)
        existing = SalesPeriod.objects.all()
        created_count = 0

        for p in detected:
            # Check if any existing period overlaps
            overlaps = existing.filter(
                start__lt=p["end"],
                end__gt=p["start"],
            ).exists()
            if not overlaps:
                s = localtime(p["start"]).strftime("%d %b %Y")
                e = localtime(p["end"]).strftime("%d %b %Y")
                SalesPeriod.objects.create(
                    name=f"Period ({s} – {e})",
                    start=p["start"],
                    end=p["end"],
                )
                created_count += 1

        if created_count:
            messages.success(request, f"{created_count} new period(s) detected and saved.")
        else:
            messages.info(request, "No new periods detected (all overlap with existing).")

        return redirect("dashboard:sales-report")

    def handle_save(self, request):
        period_ids = request.POST.getlist("period_id")
        delete_ids = request.POST.getlist("delete")

        # Delete checked periods
        if delete_ids:
            SalesPeriod.objects.filter(id__in=delete_ids).delete()

        # Update remaining periods
        for pid in period_ids:
            if pid in delete_ids:
                continue
            try:
                period = SalesPeriod.objects.get(id=pid)
            except SalesPeriod.DoesNotExist:
                continue
            name = request.POST.get(f"name_{pid}", period.name)
            start = request.POST.get(f"start_{pid}", "")
            end = request.POST.get(f"end_{pid}", "")
            period.name = name
            if start:
                period.start = timezone.make_aware(
                    timezone.datetime.strptime(start, "%Y-%m-%dT%H:%M")
                ) if timezone.is_naive(
                    timezone.datetime.strptime(start, "%Y-%m-%dT%H:%M")
                ) else timezone.datetime.strptime(start, "%Y-%m-%dT%H:%M")
            if end:
                period.end = timezone.make_aware(
                    timezone.datetime.strptime(end, "%Y-%m-%dT%H:%M")
                ) if timezone.is_naive(
                    timezone.datetime.strptime(end, "%Y-%m-%dT%H:%M")
                ) else timezone.datetime.strptime(end, "%Y-%m-%dT%H:%M")
            period.save()

        messages.success(request, "Periods saved.")
        return redirect("dashboard:sales-report")

    def handle_export(self, request):
        periods = SalesPeriod.objects.all()
        if not periods.exists():
            messages.error(request, "No periods to export. Detect periods first.")
            return redirect("dashboard:sales-report")
        return self.generate_report(periods)

    @staticmethod
    def detect_periods(orders):
        """Split orders into sales periods based on 72h+ gaps."""
        if not orders:
            return []
        sorted_orders = list(orders.order_by("date_placed"))
        periods = []
        current = {
            "start": sorted_orders[0].date_placed,
            "end": sorted_orders[0].date_placed,
        }
        for order in sorted_orders[1:]:
            if order.date_placed - current["end"] > timedelta(hours=72):
                periods.append(current)
                current = {
                    "start": order.date_placed,
                    "end": order.date_placed,
                }
            else:
                current["end"] = order.date_placed
        periods.append(current)
        return periods

    def generate_report(self, periods):
        """Generate multi-sheet Excel from saved SalesPeriod objects."""
        summary_rows = []
        product_rows = []
        order_rows = []

        for p in periods:
            p_orders = Order.objects.filter(
                date_placed__gte=p.start,
                date_placed__lte=p.end,
            ).exclude(status="Cancelled")

            revenue = sum(
                o.total_incl_tax_with_donation - o.donation_amount
                for o in p_orders
            )
            donations = sum(o.donation_amount for o in p_orders)
            count = p_orders.count()

            summary_rows.append({
                "Period": p.name,
                "Start": localtime(p.start).strftime("%Y-%m-%d %H:%M"),
                "End": localtime(p.end).strftime("%Y-%m-%d %H:%M"),
                "Orders": count,
                "Revenue": float(revenue),
                "Donations": float(donations),
                "Avg Order Value": round(float(revenue) / count, 2) if count else 0,
            })

            # Product breakdown for this period
            lines = (
                OrderLine.objects.filter(order__in=p_orders)
                .values("product__title")
                .annotate(
                    qty=Sum("quantity"),
                    revenue=Sum("line_price_incl_tax"),
                )
                .order_by("-qty")
            )
            for line in lines:
                product_rows.append({
                    "Period": p.name,
                    "Product": line["product__title"],
                    "Qty Sold": line["qty"],
                    "Revenue": float(line["revenue"] or 0),
                })

            # All orders for this period
            for o in p_orders:
                items = ", ".join(
                    f"{l.product.title}: {l.quantity}" for l in o.lines.all()
                )
                order_rows.append({
                    "Period": p.name,
                    "Order #": o.number,
                    "Customer": o.user.get_full_name() if o.user else "Guest",
                    "Date": localtime(o.date_placed).strftime("%Y-%m-%d %H:%M:%S"),
                    "Status": o.status,
                    "Items": items,
                    "Total": float(o.total_incl_tax_with_donation - o.donation_amount),
                    "Donation": float(o.donation_amount),
                })

        df_summary = pd.DataFrame(summary_rows)
        df_products = pd.DataFrame(product_rows)
        df_orders = pd.DataFrame(order_rows)

        buf = BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df_summary.to_excel(writer, sheet_name="Summary", index=False)
            df_products.to_excel(writer, sheet_name="Product Breakdown", index=False)
            df_orders.to_excel(writer, sheet_name="All Orders", index=False)

        response = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="sales_report.xlsx"'
        return response


class PendingCheckoutDashboardView(View):
    """Superuser-only dashboard view for managing pending checkouts."""

    template_name = "oscar/dashboard/orders/pending_checkouts.html"

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            messages.error(request, "You do not have permission to access this page.")
            return redirect("dashboard:index")
        return super().dispatch(request, *args, **kwargs)

    def get(self, request):
        pending = PendingCheckout.objects.all().order_by("-created_at")

        enriched = []
        for pc in pending:
            snapshot = pc.basket_snapshot or {}
            basket_total = snapshot.get("total")
            if basket_total is not None:
                basket_total = Decimal(basket_total)
                expected_total = basket_total + Decimal(pc.donation or 0)
            else:
                expected_total = None
            enriched.append({
                "obj": pc,
                "lines": snapshot.get("lines", []),
                "discounts": snapshot.get("discounts", []),
                "shipping": snapshot.get("shipping"),
                "basket_total": basket_total,
                "expected_total": expected_total,
            })

        return render(request, self.template_name, {"pending_checkouts": enriched})

    def post(self, request):
        """Manually place an order from a pending checkout and confirm payment."""
        from apps.util.views import _place_order_from_pending
        from apps.util.payments import confirm_paynow_payment, PaymentConfirmationError

        pending_id = request.POST.get("pending_id")
        amount = request.POST.get("amount", "").strip()

        if not pending_id or not amount:
            messages.error(request, "Pending checkout ID and amount are required.")
            return redirect("dashboard:pending-checkouts")

        try:
            pending = PendingCheckout.objects.get(id=pending_id)
        except PendingCheckout.DoesNotExist:
            messages.error(request, "Pending checkout not found.")
            return redirect("dashboard:pending-checkouts")

        try:
            amount_decimal = Decimal(amount)
        except Exception:
            messages.error(request, "Invalid amount.")
            return redirect("dashboard:pending-checkouts")

        result = _place_order_from_pending(pending, amount_decimal)
        if result["error"]:
            messages.error(request, f"Failed to place order: {result['error']}")
            return redirect("dashboard:pending-checkouts")

        order = result["order"]

        try:
            confirm_paynow_payment(order, amount_decimal)
            messages.success(
                request,
                f"Order {order.number} created and payment confirmed "
                f"(SGD {amount_decimal}).",
            )
        except PaymentConfirmationError as e:
            messages.warning(
                request,
                f"Order {order.number} created but payment confirmation "
                f"failed: {e}. Please verify manually.",
            )

        return redirect("dashboard:order-detail", number=order.number)
