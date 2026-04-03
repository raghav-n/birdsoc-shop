from django.db import models
from oscar.apps.partner.abstract_models import AbstractStockRecord


class StockRecord(AbstractStockRecord):
    crossed_out_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Original price to display crossed out (e.g. before discount).",
    )
    cost_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Cost price per unit (used for profit calculations in dashboard).",
    )


from oscar.apps.partner.models import *  # noqa
