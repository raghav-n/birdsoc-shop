from datetime import datetime
from decimal import Decimal

from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.db.models import Sum, Count, Q
from django.views.generic import ListView

from apps.payment.models import Donation


class DashboardMixin(LoginRequiredMixin, PermissionRequiredMixin):
    permission_required = ["is_superuser"]

    def has_permission(self):
        return self.request.user.is_superuser


class DonationListView(DashboardMixin, ListView):
    model = Donation
    context_object_name = "donations"
    template_name = "dashboard/donation/donation_list.html"
    paginate_by = 50

    def get_queryset(self):
        qs = Donation.objects.all()

        q = self.request.GET.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q) | Q(email__icontains=q) | Q(reference__icontains=q)
            )

        start = self.request.GET.get("start", "").strip()
        end = self.request.GET.get("end", "").strip()
        try:
            if start:
                qs = qs.filter(created_at__date__gte=datetime.strptime(start, "%Y-%m-%d").date())
            if end:
                qs = qs.filter(created_at__date__lte=datetime.strptime(end, "%Y-%m-%d").date())
        except ValueError:
            pass

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        qs = self.get_queryset()
        agg = qs.aggregate(total=Sum("amount"), count=Count("id"))
        ctx["total_amount"] = agg["total"] or Decimal("0")
        ctx["total_count"] = agg["count"] or 0
        ctx["q"] = self.request.GET.get("q", "")
        ctx["start"] = self.request.GET.get("start", "")
        ctx["end"] = self.request.GET.get("end", "")
        return ctx
