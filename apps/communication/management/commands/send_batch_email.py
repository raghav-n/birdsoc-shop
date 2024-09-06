from django.conf import settings
from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.core.management.base import BaseCommand
import pandas as pd
from django.template.loader import render_to_string


class Command(BaseCommand):
    help = "Sends a customized batch email."

    def add_arguments(self, parser):
        parser.add_argument(
            "--emails",
            type=str,
            help="Requires only one column: `email`. "
            "Additional columns are optional, and are used as context variables.",
        )
        parser.add_argument("--template", type=str, help="Template for the email.")
        parser.add_argument("--subject", type=str, help="Subject for the email.")
        parser.add_argument("--from_email", type=str, help="Subject for the email.")
        parser.add_argument("--reply_to_email", type=str, help="Subject for the email.")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        if options["emails"].endswith("xlsx"):
            df = pd.read_excel(options["emails"])
        else:
            df = pd.read_csv(options["emails"])

        if "email" not in df.columns:
            raise ValueError("Column missing in input spreadsheet: 'email'.")

        from_email = settings.DEFAULT_FROM_EMAIL
        if options.get("from_email"):
            from_email = options["from_email"]

        reply_to_email = []
        if from_email == settings.OSCAR_FROM_EMAIL:
            reply_to_email = [options.get("reply_to_email") or settings.REPLY_TO_EMAIL]

        for idx, row in df.iterrows():
            content = render_to_string(options["template"], context=row.to_dict())
            email = EmailMultiAlternatives(
                options["subject"],
                "",
                from_email=from_email,
                to=[row["email"]],
                reply_to=reply_to_email,
            )
            email.attach_alternative(content, "text/html")
            if options["dry_run"]:
                print(f"Email to {row.email} prepared successfully.")
            else:
                email.send()
