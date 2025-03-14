import json
import pandas as pd
from datetime import date

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

Product = get_model('catalogue', 'Product')
Line = get_model('basket', 'Line')
Order = get_model('order', 'Order')
Basket = get_model("basket", "Basket")
Selector = get_class("partner.strategy", "Selector")
OrderTotalCalculator = get_class("checkout.calculators", "OrderTotalCalculator")
Source = get_model("payment", "Source")
DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
ShippingAddress = get_model('order', 'ShippingAddress')
Country = get_model('address', 'Country')
PaymentEvent = get_model('order', 'PaymentEvent')
PaymentEventType = get_model('order', 'PaymentEventType')
PaymentEventQuantity = get_model('order', 'PaymentEventQuantity')
SourceType = get_model('payment', 'SourceType')
OrderCreator = get_class('order.utils', 'OrderCreator')


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
    template_name = 'oscar/dashboard/orders/onsite_purchase.html'
    
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        
        # Get all parent products and products without variants (standalones)
        # Filter out products with no stock or price
        products = Product.objects.filter(
            is_public=True
        ).filter(
            # Include standalone products or parent products that have children
            models.Q(structure='standalone') | 
            models.Q(structure='parent')
        ).distinct()
        
        # Filter further to ensure they have stock records and are purchasable
        available_products = []
        
        for product in products:
            # For standalone products, check if they have stock records
            if product.structure == 'standalone':
                if product.has_stockrecords and product.stockrecords.exists():
                    # Check stock level
                    stockrecord = product.stockrecords.first()
                    if stockrecord.num_in_stock is not None and stockrecord.num_in_stock > 0:
                        strategy = Selector().strategy()
                        info = strategy.fetch_for_product(product)
                        available_products.append([product, info])
            
            # For parent products, check if any of their children have stock records
            elif product.structure == 'parent':
                children = product.children.filter(is_public=True)
                has_available_children = False
                
                for child in children:
                    if child.has_stockrecords and child.stockrecords.exists():
                        stockrecord = child.stockrecords.first()
                        if stockrecord.num_in_stock is not None and stockrecord.num_in_stock > 0:
                            has_available_children = True
                            break
                
                if has_available_children:
                    available_products.append(product)
        
        # Sort products in the required order: keychains, stickers, hat, pin
        def get_product_sort_key(product_info):
            product = product_info[0] if isinstance(product_info, list) else product_info
            title = product.title.lower()
            
            # Define priorities (lower number = higher priority)
            if 'keychain' in title:
                return 1
            elif 'sticker' in title:
                return 2
            elif 'hat' in title:
                return 3
            elif 'pin' in title:
                return 4
            else:
                return 5  # All other products last
        
        # Sort the products by the custom ordering
        available_products.sort(key=get_product_sort_key)
        
        ctx['products'] = available_products
        
        # Generate a unique 6-digit alphanumeric order number starting with 2
        # Attempt up to 10 times to generate a unique order number
        max_attempts = 10
        attempts = 0
        order_number = None
        
        while attempts < max_attempts:
            # Generate a new candidate order number
            candidate_number = '2' + get_random_string(length=5, allowed_chars='0123456789ABCDEFGHJKLMNPQRSTUVWXYZ')
            
            # Check if this number is already used
            if not Order.objects.filter(number=candidate_number).exists():
                order_number = candidate_number
                break
                
            attempts += 1
        
        # If all attempts failed, use timestamp-based fallback
        if not order_number:
            timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
            order_number = f"2{timestamp[-6:]}"
            
        ctx['order_number'] = order_number
        ctx['reference_id'] = f"{settings.ORDER_PREFIX}{order_number}"
        ctx['settings'] = settings  # Add settings to context for template access
        
        return ctx
    
    def post(self, request, *args, **kwargs):
        from django.contrib.auth.models import User
        from oscar.apps.partner.models import StockRecord
        from oscar.core.loading import get_class

        data = request.POST
        product_quantities = {}
        order_number = data.get('order_number')  # Get the order number from the form
        voucher_code = data.get('voucher_code', '')
        
        # Get selected product quantities
        for key, value in data.items():
            if key.startswith('quantity_') and value and int(value) > 0:
                product_id = key.replace('quantity_', '')
                product_quantities[product_id] = int(value)
        
        if not product_quantities:
            messages.error(request, "Please select at least one product.")
            return self.get(request, *args, **kwargs)
        
        # Create a basket with the selected products
        with transaction.atomic():
            # Create or get a guest user for the order
            guest_user, created = User.objects.get_or_create(
                username=f'guest_{timezone.now().strftime("%Y%m%d%H%M%S")}',
                defaults={
                    'is_active': False,
                    'first_name': 'Onsite',
                    'last_name': 'Customer'
                }
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
                    if stockrecord.num_in_stock is not None and stockrecord.num_in_stock < quantity:
                        messages.error(
                            request, 
                            f"Not enough stock for {product.title}. Available: {stockrecord.num_in_stock}, Requested: {quantity}"
                        )
                        return self.get(request, *args, **kwargs)
                    
                    # Track for later update
                    stock_updates.append((stockrecord, quantity))
                
                basket.add_product(product, quantity=quantity)
            
            # Apply voucher if one was used
            voucher = None
            if voucher_code:
                try:
                    voucher = Voucher.objects.get(code=voucher_code)
                    # Add voucher to basket to apply the discount
                    basket.vouchers.add(voucher)
                    
                    # Apply the offers to the basket (including voucher offers)
                    Applicator = get_class('offer.applicator', 'Applicator')
                    applicator = Applicator()
                    applicator.apply(basket, request.user, request)
                except Voucher.DoesNotExist:
                    voucher = None
            
            # Get the basket total AFTER applying vouchers/offers
            total_incl_tax = basket.total_incl_tax
            
            # If payment was confirmed (from the form)
            if 'confirm_order' in data:
                shipping_method = DynamicShippingMethod.objects.get(code="ONSITE")
                
                # Calculate the order total with any discounts from the voucher
                order_total = OrderTotalCalculator().calculate(
                    basket, 
                    shipping_charge=shipping_method.calculate(basket)
                )
                
                # Create the order with the discounted total
                order_creator = OrderCreator()
                order = order_creator.place_order(
                    basket=basket,
                    total=order_total,  # This now includes any voucher discounts
                    shipping_method=shipping_method,
                    shipping_charge=shipping_method.calculate(basket),
                    user=guest_user,
                    order_number=order_number,
                    status=settings.COLLECTED_STATUS,
                )
                
                # Record voucher usage against the order
                if voucher:
                    voucher.record_usage(order, request.user)
                    
                    # Add a note about the voucher
                    order.notes.create(
                        user=request.user,
                        message=f"Voucher {voucher.code} applied for a discount of "
                                f"${(basket.total_excl_tax_excl_discounts - basket.total_excl_tax):.2f}",
                        note_type="System"
                    )
                
                # Create payment source and event with the DISCOUNTED total
                paynow_reference = f"{settings.ORDER_PREFIX}{order_number}"
                source_type, _ = SourceType.objects.get_or_create(name="PayNow")
                source = Source.objects.create(
                    source_type=source_type,
                    amount_allocated=total_incl_tax,
                    amount_debited=total_incl_tax,
                    reference=paynow_reference,
                    order=order
                )
                
                # Create payment event with the DISCOUNTED total
                event_type, _ = PaymentEventType.objects.get_or_create(name="Payment")
                event = PaymentEvent.objects.create(
                    event_type=event_type,
                    amount=total_incl_tax,  # Use the discounted total
                    reference=paynow_reference,
                    order=order
                )
                
                # Link the payment event to the order lines
                for line in order.lines.all():
                    PaymentEventQuantity.objects.create(
                        event=event,
                        line=line,
                        quantity=line.quantity
                    )
                
                # Update stock levels after successful order creation
                for stockrecord, quantity in stock_updates:
                    # Reduce stock count
                    if stockrecord.num_in_stock is not None:
                        stockrecord.num_in_stock -= quantity
                        stockrecord.save()
                
                # Add voucher usage information if used
                if voucher:
                    # If not already added by the order placement
                    VoucherApplication = get_model('voucher', 'VoucherApplication')
                    if not VoucherApplication.objects.filter(voucher=voucher, order=order).exists():
                        VoucherApplication.objects.create(
                            voucher=voucher,
                            user=request.user,
                            order=order,
                            offer=voucher.offers.first()
                        )
                
                # Add a success message that mentions the discount if applicable
                success_message = f"Order {paynow_reference} created successfully. Stock levels updated."
                if voucher:
                    original_total = basket.total_excl_tax_excl_discounts
                    discounted_total = basket.total_excl_tax
                    discount_amount = original_total - discounted_total
                    success_message += f" Discount of ${discount_amount:.2f} applied."
                    
                messages.success(request, success_message)
                return redirect('dashboard:order-detail', number=order.number)
            
            # If just generating QR code
            return self.render_to_response({
                'products': Product.objects.filter(
                    is_public=True
                ).filter(
                    # Include standalone products or parent products that have children
                    models.Q(structure='standalone') | 
                    models.Q(structure='parent')
                ).distinct(),
                'selected_products': product_quantities,
                'total_incl_tax': total_incl_tax,  # This now includes any discounts
                'order_number': order_number,  # Pass the order number back to the template
                'reference_id': data.get('reference_id'),
                'settings': settings,
                'show_payment': True,
                'voucher_code': voucher_code,
                'original_total': getattr(basket, 'total_excl_tax_excl_discounts', total_incl_tax),
                'discount_amount': getattr(basket, 'total_excl_tax_excl_discounts', total_incl_tax) - total_incl_tax 
                                  if voucher else 0,
            })


class VoucherCheckView(View):
    """View to validate vouchers via AJAX for the onsite purchase page"""
    
    @method_decorator(staff_member_required)
    def post(self, request):
        code = request.POST.get('voucher', '')
        
        # Get selected products and quantities
        products = {}
        for key, value in request.POST.items():
            if key.startswith('product_') and value:
                # Format: product_ID
                product_id = key.replace('product_', '')
                quantity = int(value)
                if quantity > 0:
                    products[product_id] = quantity
        
        # If no product IDs are provided directly, try to parse a JSON array
        if not products and request.POST.get('products'):
            try:
                import json
                products_data = json.loads(request.POST.get('products'))
                for item in products_data:
                    products[str(item['id'])] = int(item['quantity'])
            except (ValueError, KeyError, TypeError) as e:
                return JsonResponse({
                    'valid': False,
                    'message': f'Invalid product data: {str(e)}'
                })
        
        try:
            voucher = Voucher.objects.get(code=code)
        except Voucher.DoesNotExist:
            return JsonResponse({
                'valid': False,
                'message': 'Voucher code not found'
            })
        
        # Create a real basket with the selected products
        from django.contrib.auth.models import AnonymousUser
        from oscar.apps.basket.models import Basket
        
        user = AnonymousUser()
        basket = Basket()
        # basket.owner = user
        
        # Add strategy to the basket
        strategy = Selector().strategy(request=request)
        basket.strategy = strategy
        
        # Add each selected product to the basket
        for product_id, quantity in products.items():
            try:
                product = Product.objects.get(id=product_id)
                basket.add_product(product, quantity=quantity)
            except Product.DoesNotExist:
                return JsonResponse({
                    'valid': False, 
                    'message': f'Product {product_id} not found'
                })
            except Exception as e:
                return JsonResponse({
                    'valid': False,
                    'message': f'Error adding product {product_id}: {str(e)}'
                })
        
        # If we don't have any items in the basket, return error
        if not basket.num_lines:
            return JsonResponse({
                'valid': False,
                'message': 'Please select at least one product'
            })
            
        # Check if voucher is available for this basket
        is_available, message = voucher.is_available_for_basket(basket=basket)
        if not is_available:
            return JsonResponse({
                'valid': False,
                'message': message or 'Voucher cannot be applied to selected products'
            })
        
        # Apply the voucher and calculate the discount
        try:
            basket.vouchers.add(voucher)
            
            # Apply offers to see the effect of the voucher
            Applicator = get_class('offer.applicator', 'Applicator')
            applicator = Applicator()
            applicator.apply(basket, user, request)
            
            # Calculate pre-discount total
            pre_discount_total = basket.total_excl_tax_excl_discounts
            
            # Calculate discount amount
            discount_amount = pre_discount_total - basket.total_excl_tax
            
            # Get benefit description for display
            benefit_desc = voucher.benefit.description
            
            return JsonResponse({
                'valid': True,
                'message': f'Voucher applied: {benefit_desc}',
                'discount': float(discount_amount),
                'new_total': float(basket.total_excl_tax)
            })
        except Exception as e:
            return JsonResponse({
                'valid': False,
                'message': f'Error applying voucher: {str(e)}'
            })