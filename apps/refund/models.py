from django.db import models
from django.utils import timezone
from django.conf import settings
from django.template.loader import render_to_string
from weasyprint import HTML


class RefundRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_DISBURSED = "disbursed"  # New status

    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_DISBURSED, "Disbursed"),  # Added to choices
    )

    name = models.CharField(max_length=255)
    email = models.EmailField()
    paynow_phone = models.CharField(max_length=15)
    order_number = models.CharField(max_length=30)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    processed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processed_refunds",
    )
    disbursed_at = models.DateTimeField(
        null=True, blank=True
    )  # New field to track when refund was disbursed
    disbursed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disbursed_refunds",
    )
    refund_number = models.CharField(max_length=30, blank=True)

    refund_voucher_template = "pdf/refund_voucher.html"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Refund request"
        verbose_name_plural = "Refund requests"

    def __str__(self):
        return f"Refund {self.id} - {self.order_number} (${self.amount})"

    def generate_refund_voucher(self):
        """Generate a PDF refund voucher"""
        context = {
            "refund": self,
            "processed_by": self.processed_by,
            "approval_date": self.updated_at.strftime("%d %b %Y"),
            "treasurer_email": settings.TREASURER_EMAIL,
        }

        template_str = render_to_string(self.refund_voucher_template, context=context)
        return HTML(string=template_str).render()

    def get_refund_voucher_as_pdf(self):
        """Generate and save the refund voucher PDF"""
        if self.status != self.STATUS_APPROVED:
            return None

        pdf_document = self.generate_refund_voucher().write_pdf()

        # Create directory if it doesn't exist
        import os

        refund_dir = settings.PROJECT_DIR / "refund_vouchers"
        os.makedirs(refund_dir, exist_ok=True)

        # Save the PDF file
        pdf_path = refund_dir / f"refund_voucher_{self.id}.pdf"
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(pdf_document)

        return pdf_document

    def is_user_treasurer(self, user):
        """Check if user is the treasurer"""
        return user.email.lower() == settings.TREASURER_EMAIL.lower()
