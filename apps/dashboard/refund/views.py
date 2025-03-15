from django.views.generic import ListView, UpdateView
from django.contrib.auth.mixins import UserPassesTestMixin
from django.urls import reverse_lazy, reverse
from django.contrib import messages
from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from django.shortcuts import redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator

from apps.refund.models import RefundRequest
from apps.refund.forms import RefundApprovalForm, RefundDisbursementForm


class SuperUserOnlyMixin(UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_superuser


class RefundListView(SuperUserOnlyMixin, ListView):
    model = RefundRequest
    template_name = "oscar/dashboard/refund/list.html"
    context_object_name = "refunds"


class RefundDetailView(SuperUserOnlyMixin, UpdateView):
    model = RefundRequest
    template_name = "oscar/dashboard/refund/detail.html"
    form_class = RefundApprovalForm
    context_object_name = "refund"
    success_url = reverse_lazy("dashboard-refund:refund-request-list")

    def form_valid(self, form):
        refund = form.save(commit=False)
        refund.processed_by = self.request.user
        refund.save()

        # If approved, send email to treasurer
        if refund.status == RefundRequest.STATUS_APPROVED:
            self.send_treasurer_email(refund)
            messages.success(
                self.request, "Refund approved and email sent to treasurer."
            )
        elif refund.status == RefundRequest.STATUS_REJECTED:
            messages.info(self.request, "Refund request rejected.")

        return super().form_valid(form)

    def send_treasurer_email(self, refund):
        subject = (
            f"REFUND DISBURSEMENT REQUEST - {refund.order_number} - ${refund.amount}"
        )

        context = {
            "refund": refund,
            "processed_by": self.request.user,
        }
        message = render_to_string(
            "oscar/refund/emails/treasurer_notification.txt", context
        )
        html_message = render_to_string(
            "oscar/refund/emails/treasurer_notification.html", context
        )

        # # Generate PDF refund voucher
        # pdf_content = refund.get_refund_voucher_as_pdf()

        # Send email to treasurer and CC admins
        email = EmailMessage(
            subject=subject,
            body=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[settings.TREASURER_EMAIL],
            cc=[m for m in settings.MANAGER_EMAILS if m != settings.TREASURER_EMAIL],
            reply_to=[settings.REPLY_TO_EMAIL],
        )
        email.content_subtype = "html"

        # # Attach the PDF voucher
        # if pdf_content:
        #     email.attach(
        #         f"Refund_Voucher_{refund.id}.pdf", pdf_content, "application/pdf"
        #     )

        email.send(fail_silently=False)


class TreasurerOnlyMixin(UserPassesTestMixin):
    def test_func(self):
        user = self.request.user
        return (
            user.is_authenticated
            and user.email.lower() == settings.TREASURER_EMAIL.lower()
        )


@method_decorator(login_required, name="dispatch")
class TreasurerRefundListView(TreasurerOnlyMixin, ListView):
    model = RefundRequest
    template_name = "oscar/dashboard/refund/treasurer_list.html"
    context_object_name = "refunds"

    def get_queryset(self):
        # Only show approved refunds that haven't been disbursed
        return RefundRequest.objects.filter(status=RefundRequest.STATUS_APPROVED)


@method_decorator(login_required, name="dispatch")
class TreasurerRefundDetailView(TreasurerOnlyMixin, UpdateView):
    model = RefundRequest
    template_name = "oscar/dashboard/refund/treasurer_detail.html"
    form_class = RefundDisbursementForm
    context_object_name = "refund"
    success_url = reverse_lazy("dashboard-refund:treasurer-list")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        refund = form.save(commit=False)

        # If status changed to disbursed
        if refund.status == RefundRequest.STATUS_DISBURSED:
            refund.disbursed_at = timezone.now()
            refund.disbursed_by = self.request.user
            refund.save()

            # Send email to the customer
            self.send_disbursement_notification(refund)
            messages.success(
                self.request, "Refund marked as disbursed. Customer has been notified."
            )

        return super().form_valid(form)

    def send_disbursement_notification(self, refund):
        subject = f"Your Refund Request has been Processed - {refund.order_number}"

        context = {
            "refund": refund,
            "disbursed_by": self.request.user,
        }
        message = render_to_string(
            "oscar/refund/emails/customer_disbursement_notification.txt", context
        )
        html_message = render_to_string(
            "oscar/refund/emails/customer_disbursement_notification.html", context
        )

        # Get the PDF refund voucher
        # pdf_content = refund.get_refund_voucher_as_pdf()

        # Send email to customer and CC admin
        email = EmailMessage(
            subject=subject,
            body=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[refund.email],
            bcc=[m for m in settings.MANAGER_EMAILS if m != refund.email],
            reply_to=[settings.REPLY_TO_EMAIL],
        )
        email.content_subtype = "html"

        # # Attach the PDF voucher
        # if pdf_content:
        #     email.attach(
        #         f"Refund_Voucher_{refund.id}.pdf", pdf_content, "application/pdf"
        #     )

        email.send(fail_silently=False)


class CompletedRefundListView(SuperUserOnlyMixin, ListView):
    """View for displaying completed (disbursed) refunds to superusers"""
    model = RefundRequest
    template_name = "oscar/dashboard/refund/completed_list.html"
    context_object_name = "refunds"
    
    def get_queryset(self):
        # Only show disbursed refunds
        return RefundRequest.objects.filter(status=RefundRequest.STATUS_DISBURSED).order_by('-disbursed_at')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['title'] = "Completed Refunds"
        
        # Add summary statistics
        refunds = self.get_queryset()
        context['total_count'] = refunds.count()
        context['total_amount'] = sum(refund.amount for refund in refunds)
        
        return context
