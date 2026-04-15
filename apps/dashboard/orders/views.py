import json
import pandas as pd
from datetime import date, timedelta
from io import BytesIO

from django import forms
from django.conf import settings
from django.contrib.auth.decorators import user_passes_test

# Redirect to the Auth0 dashboard login instead of /admin/login/
console_staff_required = user_passes_test(
    lambda u: u.is_active and u.is_staff,
    login_url="/dashboard/login/",
)
from django.core.mail import EmailMultiAlternatives
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse, HttpResponse, Http404
from django.shortcuts import render, get_object_or_404
from django.template.loader import render_to_string
from django.utils.decorators import method_decorator
from django.utils.timezone import localtime
from django.views import View
from oscar.core.loading import get_model, get_class
from django.db import models
from django.db.models import Q
from django.views.generic import RedirectView, FormView
from django.shortcuts import redirect
from django.contrib import messages
from django.utils import timezone
from django.urls import reverse
from decimal import Decimal
from django.db.models import Count, Sum
from sentry_sdk import capture_exception

from apps.order.utils import (
    OrderDeletionNotAllowed,
    delete_order_and_release_allocations,
)
from oscar.apps.dashboard.orders.views import (
    OrderDetailView as BaseOrderDetailView,
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
ShippingAddress = get_model("order", "ShippingAddress")
Country = get_model("address", "Country")
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


class OrderDetailView(BaseOrderDetailView):
    order_actions = BaseOrderDetailView.order_actions + ("delete_order",)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["can_delete_order"] = (
            self.request.user.is_superuser
            and self.object.status != settings.COLLECTED_STATUS
        )
        return ctx

    def delete_order(self, request, order):
        if not request.user.is_superuser:
            raise PermissionDenied

        try:
            allocations_released, _ = delete_order_and_release_allocations(order)
        except OrderDeletionNotAllowed as exc:
            messages.error(request, str(exc))
            return self.reload_page()

        messages.success(
            request,
            f"Deleted order {order.number}. Released {allocations_released} allocation(s).",
        )
        return redirect("dashboard:order-list")


@method_decorator(console_staff_required, name="dispatch")
class OnsitePurchaseView(RedirectView):
    permanent = False
    query_string = True
    url = "/onsite-purchase"


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


@method_decorator(console_staff_required, name="dispatch")
class SalesReportView(View):
    template_name = "oscar/dashboard/orders/sales_report.html"

    def get(self, request):
        form = OrderExportForm()
        return render(request, self.template_name, self.get_context_data(form=form))

    def get_context_data(self, form):
        periods = SalesPeriod.objects.all()
        period_rows, period_chart_data = self.build_period_rows(periods)
        return {
            "form": form,
            "periods": periods,
            "period_rows": period_rows,
            "period_chart_data": period_chart_data,
        }

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
            return render(request, self.template_name, self.get_context_data(form=form))

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

    @staticmethod
    def build_period_rows(periods):
        period_rows = []
        period_chart_data = {}

        for period in periods:
            orders = list(
                Order.objects.filter(
                    date_placed__gte=period.start,
                    date_placed__lte=period.end,
                )
                .exclude(status="Cancelled")
                .order_by("date_placed")
            )

            revenue = Decimal("0.00")
            donations = Decimal("0.00")
            cumulative_orders = 0
            cumulative_revenue = Decimal("0.00")
            daily_totals = {}

            for order in orders:
                order_revenue = order.total_incl_tax_with_donation - order.donation_amount
                revenue += order_revenue
                donations += order.donation_amount

                order_day = localtime(order.date_placed).strftime("%d %b %Y")
                if order_day not in daily_totals:
                    daily_totals[order_day] = {
                        "orders": 0,
                        "revenue": Decimal("0.00"),
                    }
                daily_totals[order_day]["orders"] += 1
                daily_totals[order_day]["revenue"] += order_revenue

            labels = []
            cumulative_order_series = []
            cumulative_revenue_series = []

            for label, totals in daily_totals.items():
                cumulative_orders += totals["orders"]
                cumulative_revenue += totals["revenue"]
                labels.append(label)
                cumulative_order_series.append(cumulative_orders)
                cumulative_revenue_series.append(float(cumulative_revenue))

            order_count = len(orders)
            avg_order_value = revenue / order_count if order_count else Decimal("0.00")

            period_rows.append(
                {
                    "id": period.id,
                    "name": period.name,
                    "start": period.start,
                    "end": period.end,
                    "order_count": order_count,
                    "revenue": revenue,
                    "donations": donations,
                    "avg_order_value": avg_order_value,
                    "date_span": (
                        f"{localtime(period.start).strftime('%d %b %Y %H:%M')} - "
                        f"{localtime(period.end).strftime('%d %b %Y %H:%M')}"
                    ),
                }
            )

            period_chart_data[str(period.id)] = {
                "id": period.id,
                "name": period.name,
                "date_span": (
                    f"{localtime(period.start).strftime('%d %b %Y %H:%M')} - "
                    f"{localtime(period.end).strftime('%d %b %Y %H:%M')}"
                ),
                "summary": {
                    "orders": order_count,
                    "revenue": float(revenue),
                    "donations": float(donations),
                    "avg_order_value": float(avg_order_value),
                },
                "chart": {
                    "labels": labels,
                    "orders": cumulative_order_series,
                    "revenue": cumulative_revenue_series,
                },
            }

        return period_rows, period_chart_data

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

        try:
            result = _place_order_from_pending(pending, amount_decimal)
        except Exception as exc:
            capture_exception(exc)
            messages.error(request, "Failed to place order.")
            return redirect("dashboard:pending-checkouts")

        order = result["order"]

        try:
            confirm_paynow_payment(order, amount_decimal)
            messages.success(
                request,
                f"Order {order.number} created and payment confirmed "
                f"(SGD {amount_decimal}).",
            )
        except PaymentConfirmationError as exc:
            capture_exception(exc)
            messages.warning(
                request,
                f"Order {order.number} created but payment confirmation failed. "
                f"Please verify manually.",
            )

        return redirect("dashboard:order-detail", number=order.number)


@method_decorator(console_staff_required, name="dispatch")
class ResendConfirmationEmailView(View):
    def post(self, request, number):
        order = get_object_or_404(Order, number=number)
        try:
            OrderDispatcher = get_class("order.utils", "OrderDispatcher")
            OrderDispatcher().send_payment_confirmed_email_for_user(order, {"order": order})
            messages.success(request, f"Confirmation email resent for order {order.number}.")
        except Exception as exc:
            capture_exception(exc)
            messages.error(request, "Failed to send confirmation email.")
        return redirect("dashboard:order-detail", number=order.number)


class OrderBulkEmailForm(forms.Form):
    sales_periods = forms.ModelMultipleChoiceField(
        queryset=SalesPeriod.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=True,
        label="Sales periods",
        help_text="Orders placed within the selected sales periods will receive this email.",
    )
    statuses = forms.MultipleChoiceField(
        choices=[],
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label="Order statuses",
        help_text="Leave all unchecked to include every status.",
    )
    subject = forms.CharField(max_length=255, required=True, label="Subject")
    message = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 12}),
        required=True,
        label="Message body",
    )
    bcc_sales = forms.BooleanField(
        required=False,
        initial=False,
        label="BCC birdsocsgsales@gmail.com",
    )
    attachment1 = forms.FileField(required=False, label="Attachment 1")
    attachment2 = forms.FileField(required=False, label="Attachment 2")
    attachment3 = forms.FileField(required=False, label="Attachment 3")
    attachment4 = forms.FileField(required=False, label="Attachment 4")
    attachment5 = forms.FileField(required=False, label="Attachment 5")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        all_statuses = list(settings.OSCAR_ORDER_STATUS_PIPELINE.keys())
        self.fields["statuses"].choices = [(s, s) for s in all_statuses]
        self.fields["message"].help_text = (
            "Available variables: {{first_name}}, {{last_name}}, {{email}}, "
            "{{order_number}}, {{order_status}}, {{date_placed}}, {{total}}, "
            "{{collection_details}}, {{order_link_button}}"
        )
        self.fields["message"].initial = (
            "<p>Hi {{first_name}},</p>"
            "<p>Your merchandise order #{{order_number}} will be ready for collection soon!</p>"
            "<p>{{collection_details}}</p>" 
            "<p>Please click on this button below to show the collection QR code; we'll scan it during collection. If you'd like to have someone else collect your order on your behalf, please send them this link: {{order_link}}</p>"
            "{{order_link_button}}"
            "<p>If you have any questions, please don't hesitate to reach out.</p>"
            "<p>Best regards,<br>Bird Society of Singapore</p>"
        )
        self.fields["subject"].initial = "BirdSoc SG Merchandise Collection"

    def get_attachments(self):
        attachments = []
        for i in range(1, 6):
            f = self.cleaned_data.get(f"attachment{i}")
            if f:
                attachments.append(f)
        return attachments


def _bulk_email_context(order):
    """Build the template-variable context dict for a single order."""
    base_url = settings.OSCAR_STATIC_BASE_URL.rstrip("/")
    order_url = f"{base_url}/orders/{order.number}?id={order.collection_access_id}"
    order_link_button = (
        f'<a href="{order_url}" '
        f'style="display:inline-block;padding:10px 22px;background-color:#222;'
        f'color:#ffffff;text-decoration:none;border-radius:4px;font-family:sans-serif;'
        f'font-size:15px;">Show collection QR code</a>'
    )
    collection_parts = []
    if order.collection_date:
        collection_parts.append(
            f"<strong>Collection date:</strong> {order.collection_date.strftime('%A, %B %d, %Y')}"
        )
    if order.collection_location:
        collection_parts.append(
            f"<strong>Location:</strong> {order.collection_location}"
        )
    return {
        "first_name": (order.user.first_name if order.user_id and order.user else "") or "",
        "last_name": (order.user.last_name if order.user_id and order.user else "") or "",
        "email": _order_recipient_email(order),
        "order_number": str(order.number),
        "order_status": order.status,
        "date_placed": localtime(order.date_placed).strftime("%B %d, %Y"),
        "total": str(order.total_incl_tax),
        "collection_details": "<br>".join(collection_parts),
        "order_link_button": order_link_button,
        "order_link": order_url,
    }


def _render_and_send_bulk_email(subject, message_template, order, recipient, bcc_list, attachments):
    """Substitute variables, render HTML, and send. Returns True on success."""
    ctx = _bulk_email_context(order)
    personalized = message_template
    for key, value in ctx.items():
        personalized = personalized.replace(f"{{{{{key}}}}}", value)
    html_message = render_to_string(
        "oscar/dashboard/orders/email/bulk_email.html",
        {"subject": subject, "message": personalized},
    )
    msg = EmailMultiAlternatives(
        subject, html_message, settings.DEFAULT_FROM_EMAIL, [recipient], bcc=bcc_list
    )
    msg.content_subtype = "html"
    for attachment, data in attachments:
        msg.attach(attachment.name, data, attachment.content_type)
    msg.send()


def _orders_for_bulk_email(sales_periods, statuses):
    q = Q()
    for period in sales_periods:
        q |= Q(date_placed__gte=period.start, date_placed__lte=period.end)
    qs = Order._default_manager.filter(q).select_related("user")
    if statuses:
        qs = qs.filter(status__in=statuses)
    return qs.order_by("-date_placed")


def _order_recipient_email(order):
    if order.user_id and order.user:
        return order.user.email
    return order.guest_email or ""


def _deduplicated_orders(orders):
    """Return one order per unique recipient email (most recent first)."""
    seen = {}
    for order in orders:
        email = _order_recipient_email(order).lower()
        if email and email not in seen:
            seen[email] = order
    return seen


@method_decorator(console_staff_required, name="dispatch")
class OrderBulkEmailView(View):
    template_name = "oscar/dashboard/orders/order_bulk_email.html"

    def get(self, request):
        form = OrderBulkEmailForm()
        return render(request, self.template_name, {"form": form})

    def post(self, request):
        form = OrderBulkEmailForm(request.POST, request.FILES)
        if not form.is_valid():
            return render(request, self.template_name, {"form": form})

        sales_periods = form.cleaned_data["sales_periods"]
        statuses = form.cleaned_data.get("statuses") or []
        subject = form.cleaned_data["subject"]
        message_template = form.cleaned_data["message"]
        bcc_sales = form.cleaned_data.get("bcc_sales") is True
        attachments = [(a, a.read()) for a in form.get_attachments()]

        orders = _orders_for_bulk_email(sales_periods, statuses)
        recipients = _deduplicated_orders(orders)

        bcc_list = []
        reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)
        if reply_to_email:
            bcc_list.append(reply_to_email)
        if bcc_sales:
            bcc_list.append("birdsocsgsales@gmail.com")
        seen_bcc = set()
        bcc_list = [x for x in bcc_list if not (x.lower() in seen_bcc or seen_bcc.add(x.lower()))]

        successful = 0
        failed = 0

        for email_lower, order in recipients.items():
            email = _order_recipient_email(order)
            try:
                _render_and_send_bulk_email(subject, message_template, order, email, bcc_list, attachments)
                successful += 1
                try:
                    order.set_status(settings.COLLECTION_INFO_SENT_STATUS)
                except Exception:
                    pass
            except Exception as exc:
                capture_exception(exc)
                failed += 1

        if failed:
            messages.warning(
                request,
                f"Sent {successful} emails successfully, but {failed} failed.",
            )
        else:
            messages.success(request, f"Successfully sent {successful} emails.")

        return redirect("dashboard:order-list")


@method_decorator(console_staff_required, name="dispatch")
class OrderBulkEmailCountView(View):
    def post(self, request):
        period_ids = request.POST.getlist("sales_periods")
        statuses = request.POST.getlist("statuses")

        if not period_ids:
            return JsonResponse({"count": 0})

        periods = SalesPeriod.objects.filter(pk__in=period_ids)
        orders = _orders_for_bulk_email(periods, statuses)
        count = len(_deduplicated_orders(orders))
        return JsonResponse({"count": count})


@method_decorator(console_staff_required, name="dispatch")
class OrderBulkEmailTestView(View):
    def post(self, request):
        subject = request.POST.get("subject", "").strip()
        message_template = request.POST.get("message", "").strip()
        test_email = request.POST.get("test_email", "").strip()

        if not subject:
            return JsonResponse({"success": False, "error": "Subject is required."})
        if not message_template:
            return JsonResponse({"success": False, "error": "Message body is required."})
        if not test_email:
            return JsonResponse({"success": False, "error": "Test email address is required."})

        period_ids = request.POST.getlist("sales_periods")
        statuses = request.POST.getlist("statuses")

        order = None
        if period_ids:
            periods = SalesPeriod.objects.filter(pk__in=period_ids)
            orders = _orders_for_bulk_email(periods, statuses)
            order = orders.order_by("?").first()

        if order is None:
            return JsonResponse({"success": False, "error": "No matching orders found for the selected filters."})

        try:
            _render_and_send_bulk_email(f"[TEST] {subject}", message_template, order, test_email, [], [])
            return JsonResponse({"success": True, "order_number": str(order.number)})
        except Exception as exc:
            capture_exception(exc)
            return JsonResponse({"success": False, "error": str(exc)})
