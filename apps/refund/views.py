from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import FormView, ListView, UpdateView
from django.contrib.auth.mixins import UserPassesTestMixin
from django.urls import reverse_lazy
from django.contrib import messages
from django.core.mail import send_mail, EmailMessage
from django.conf import settings
from django.template.loader import render_to_string

from .models import RefundRequest
from .forms import RefundRequestForm, RefundApprovalForm


class RefundRequestView(FormView):
    template_name = "oscar/refund/refund_form.html"
    form_class = RefundRequestForm
    success_url = reverse_lazy("refund:thanks")

    def form_valid(self, form):
        refund_request = form.save()

        # Send confirmation email to customer
        self.send_confirmation_email(refund_request)

        # Send notification email to admins
        self.send_admin_notification(refund_request)

        return super().form_valid(form)

    def send_confirmation_email(self, refund_request):
        subject = f"Refund Request Confirmation - {refund_request.order_number}"
        context = {
            "refund": refund_request,
        }
        message = render_to_string(
            "oscar/refund/emails/confirmation_email.txt", context
        )
        html_message = render_to_string(
            "oscar/refund/emails/confirmation_email.html", context
        )

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[refund_request.email],
            html_message=html_message,
            fail_silently=False,
        )

    def send_admin_notification(self, refund_request):
        subject = f"New Refund Request - {refund_request.order_number}"
        context = {
            "refund": refund_request,
            "admin_url": self.request.build_absolute_uri(
                reverse_lazy(
                    "dashboard-refund:refund-request-detail", args=[refund_request.id]
                )
            ),
        }
        message = render_to_string(
            "oscar/refund/emails/admin_notification.txt", context
        )
        html_message = render_to_string(
            "oscar/refund/emails/admin_notification.html", context
        )

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=settings.MANAGER_EMAILS,
            html_message=html_message,
            fail_silently=False,
        )


class RefundThanksView(FormView):
    template_name = "oscar/refund/thanks.html"
    form_class = RefundRequestForm  # Not used but needed for FormView
