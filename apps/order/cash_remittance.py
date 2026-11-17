"""Cash remittance statement for a sales period.

Lists every sale paid in cash during a SalesPeriod, so the member who took the
cash can record handing it over to the Society by PayNow, and the Treasurer can
confirm it arrived. Rendered to PDF with WeasyPrint, like order receipts.
"""

import os
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles import finders
from django.template.loader import render_to_string
from django.templatetags.static import static
from django.utils import timezone
from django.utils.timezone import localtime
from oscar.core.loading import get_model
from weasyprint import HTML

TEMPLATE = "pdf/cash_remittance.html"
LOGO = "img/logo-soc.png"
# Bundled because the server has no Noto Sans installed (WeasyPrint would fall
# back to whatever system sans it finds).
FONT_REGULAR = "fonts/noto-sans/NotoSans-Regular.ttf"
FONT_BOLD = "fonts/noto-sans/NotoSans-Bold.ttf"
ZERO = Decimal("0.00")


def _is_cash(source):
    # Older onsite orders used a "cash" source type, newer ones "Cash".
    return source.source_type.name.lower() == "cash"


def cash_orders(period):
    """Orders in the period paid (at least partly) in cash, oldest first."""
    Order = get_model("order", "Order")
    return (
        Order.objects.filter(
            date_placed__gte=period.start,
            date_placed__lte=period.end,
            sources__source_type__name__iexact="cash",
        )
        .exclude(status="Cancelled")
        .distinct()
        .order_by("date_placed")
        .prefetch_related("lines", "sources__source_type")
    )


def build_context(period, prepared_by=""):
    days = []
    totals = {"count": 0, "goods": ZERO, "donations": ZERO, "cash": ZERO, "refunded": ZERO}

    for n, order in enumerate(cash_orders(period), start=1):
        placed = localtime(order.date_placed)
        sources = [s for s in order.sources.all() if _is_cash(s)]
        cash = sum((s.amount_debited for s in sources), ZERO)
        refunded = sum((s.amount_refunded for s in sources), ZERO)
        donation = Decimal(order.donation_amount)

        if not days or days[-1]["date"] != placed.date():
            days.append({
                "date": placed.date(),
                "label": placed.strftime("%A, %d %B %Y"),
                "rows": [],
                "count": 0,
                "goods": ZERO,
                "donations": ZERO,
                "cash": ZERO,
            })
        day = days[-1]
        day["rows"].append({
            "n": n,
            "time": placed.strftime("%H:%M"),
            "reference": f"{settings.ORDER_PREFIX}{order.number}",
            "items": [{"title": line.title, "quantity": line.quantity} for line in order.lines.all()],
            "goods": order.total_incl_tax,
            "donation": donation,
            "cash": cash,
            "refunded": refunded,
        })
        day["count"] += 1
        day["goods"] += order.total_incl_tax
        day["donations"] += donation
        day["cash"] += cash

        totals["count"] += 1
        totals["goods"] += order.total_incl_tax
        totals["donations"] += donation
        totals["cash"] += cash
        totals["refunded"] += refunded

    net_cash = totals["cash"] - totals["refunded"]
    start, end = localtime(period.start), localtime(period.end)
    return {
        "period": period,
        "reference": f"CR-{start:%Y%m%d}-{period.pk}",
        "period_start": start.strftime("%d %b %Y, %H:%M"),
        "period_end": end.strftime("%d %b %Y, %H:%M"),
        "generated_at": localtime(timezone.now()).strftime("%d %b %Y, %H:%M"),
        "prepared_by": prepared_by,
        "days": days,
        "totals": totals,
        "net_cash": net_cash,
        "net_cash_words": amount_in_words(net_cash),
        "logo_uri": _static_uri(LOGO),
        "font_regular_uri": _static_uri(FONT_REGULAR),
        "font_bold_uri": _static_uri(FONT_BOLD),
        "home_page": settings.SOCIETY_HOME_PAGE.split("://", 1)[-1].rstrip("/"),
    }


def render_pdf(period, prepared_by="") -> bytes:
    html = render_to_string(TEMPLATE, build_context(period, prepared_by))
    return HTML(string=html).write_pdf()


def _static_uri(name):
    # Read static files from disk when we can, so rendering doesn't depend on
    # fetching our own site. In production they live under STATIC_ROOT.
    candidates = [finders.find(name)]
    if getattr(settings, "STATIC_ROOT", None):
        candidates.append(os.path.join(settings.STATIC_ROOT, name))
    for path in candidates:
        if path and os.path.exists(path):
            return Path(path).resolve().as_uri()
    return settings.OSCAR_STATIC_BASE_URL.rstrip("/") + static(name)


_ONES = (
    "zero one two three four five six seven eight nine ten eleven twelve "
    "thirteen fourteen fifteen sixteen seventeen eighteen nineteen"
).split()
_TENS = "- - twenty thirty forty fifty sixty seventy eighty ninety".split()


def _words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + (f"-{_ONES[n % 10]}" if n % 10 else "")
    if n < 1000:
        rest = n % 100
        return f"{_ONES[n // 100]} hundred" + (f" and {_words(rest)}" if rest else "")
    for size, name in ((10**9, "billion"), (10**6, "million"), (1000, "thousand")):
        if n >= size:
            rest = n % size
            joiner = " and " if rest < 100 else " "
            return f"{_words(n // size)} {name}" + (f"{joiner}{_words(rest)}" if rest else "")
    raise AssertionError("unreachable")


def amount_in_words(amount: Decimal) -> str:
    """1242.50 -> 'One thousand two hundred and forty-two Singapore dollars and fifty cents'."""
    cents_total = int((Decimal(amount) * 100).quantize(Decimal("1")))
    dollars, cents = divmod(abs(cents_total), 100)
    text = f"{_words(dollars)} Singapore dollar{'' if dollars == 1 else 's'}"
    text += f" and {_words(cents)} cent{'' if cents == 1 else 's'}" if cents else " only"
    if cents_total < 0:
        text = f"minus {text}"
    return text[0].upper() + text[1:]
