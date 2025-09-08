from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
import logging

logger = logging.getLogger(__name__)


class ContactFormAPIView(APIView):
    """
    API endpoint for contact form submissions.

    Accepts contact form data and sends email to the configured recipients.
    Designed to be used by event-specific sites and other external applications.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """
        Submit a contact form message.

        Expected fields:
        - name (required): Full name of the sender
        - email (required): Email address of the sender
        - subject (required): Subject of the message
        - body (required): Message content
        - pdpa_agreement (required): Boolean indicating agreement to data protection notice
        - event_id (optional): ID of related event if this is event-specific
        """
        # Extract and validate required fields
        name = (request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip()
        subject = (request.data.get("subject") or "").strip()
        body = (request.data.get("body") or "").strip()
        pdpa_agreement = request.data.get("pdpa_agreement")
        event_id = request.data.get("event_id")

        # Validation
        errors = {}

        if not name:
            errors["name"] = "Name is required"
        elif len(name) < 2:
            errors["name"] = "Name must be at least 2 characters"

        if not email:
            errors["email"] = "Email is required"
        else:
            try:
                validate_email(email)
            except ValidationError:
                errors["email"] = "Please enter a valid email address"

        if not subject:
            errors["subject"] = "Subject is required"
        elif len(subject) < 5:
            errors["subject"] = "Subject must be at least 5 characters"

        if not body:
            errors["body"] = "Message is required"
        elif len(body) < 10:
            errors["body"] = "Message must be at least 10 characters"

        if not pdpa_agreement:
            errors["pdpa_agreement"] = (
                "You must agree to the data protection notice to continue"
            )

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Optional event validation
        event = None
        if event_id:
            try:
                from oscar.core.loading import get_model

                OrganizedEvent = get_model("event", "OrganizedEvent")
                event = OrganizedEvent.objects.get(id=event_id)
            except (OrganizedEvent.DoesNotExist, ValueError):
                errors["event_id"] = "Invalid event ID"
                return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Prepare email context
            context = {
                "name": name,
                "email": email,
                "subject": subject,
                "body": body,
                "event": event,
            }

            # Render email content
            email_body = render_to_string(
                "django_contact_form/emails/contact_form.html", context
            )
            email_subject = render_to_string(
                "django_contact_form/emails/contact_form_subject.txt", context
            ).strip()

            # Prepare recipient list
            recipient_list = getattr(settings, "MANAGERS", [])
            if not recipient_list:
                recipient_list = [
                    getattr(settings, "DEFAULT_FROM_EMAIL", "admin@example.com")
                ]

            # If it's a list of tuples (name, email), extract emails
            if recipient_list and isinstance(recipient_list[0], (list, tuple)):
                recipient_list = [email for name, email in recipient_list]

            # Create and send email
            from_email = getattr(
                settings, "OSCAR_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL
            )

            email_message = EmailMessage(
                subject=email_subject,
                body=email_body,
                from_email=from_email,
                to=recipient_list,
                reply_to=[email],  # Set reply-to to the contact form sender's email
            )

            # Set content type to HTML
            email_message.content_subtype = "html"

            # Send email
            email_message.send()

            logger.info(
                f"Contact form submission sent from {email} with subject: {subject}"
            )

            return Response(
                {
                    "success": True,
                    "message": "Thank you for your message! We will respond via email as soon as possible.",
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(f"Failed to send contact form email: {str(e)}")
            return Response(
                {
                    "success": False,
                    "message": "Failed to send message. Please try again later.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
