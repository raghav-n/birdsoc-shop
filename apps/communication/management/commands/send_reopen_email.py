from django.conf import settings
from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.core.management.base import BaseCommand
import pandas as pd
from django.template.loader import render_to_string
from django.utils import timezone

from oscar.core.loading import get_model


class Command(BaseCommand):
    help = "Sends a customized batch email."

    def add_arguments(self, parser):
        parser.add_argument("--template", type=str, help="Template for the email.", default="oscar/communication/emails/adhoc/reopen_site.html")
        parser.add_argument("--subject", type=str, help="Subject for the email.", default="The BirdSoc SG Shop is open again!")
        parser.add_argument("--from_email", type=str, help="Subject for the email.", default=settings.DEFAULT_FROM_EMAIL)
        parser.add_argument("--reply_to_email", type=str, help="Reply-to email for the email.")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        EmailAlert = get_model("customer", "EmailAlert")

        from_email = options["from_email"]

        reply_to_email = []
        if from_email == settings.OSCAR_FROM_EMAIL:
            reply_to_email = [options.get("reply_to_email") or settings.REPLY_TO_EMAIL]

        sent = []

        for email_addr in set(EmailAlert._default_manager.filter(sent_date__isnull=True).values_list("email", flat=True)):
            sent.append(email_addr)
            content = render_to_string(options["template"])
            email = EmailMultiAlternatives(
                options["subject"],
                "",
                from_email=from_email,
                to=[email_addr],
                reply_to=reply_to_email,
            )
            email.attach_alternative(content, "text/html")

            if options["dry_run"]:
                print(f"Email to {email_addr} prepared successfully.")
            else:
                email.send()
                print(f"Email to {email_addr} sent successfully.")

        if not options["dry_run"]:
            EmailAlert._default_manager.filter(email__in=sent).update(sent_date=timezone.localtime().date())
