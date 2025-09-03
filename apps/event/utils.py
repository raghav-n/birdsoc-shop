from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template import Template, Context
from django.template.loader import render_to_string
import logging

logger = logging.getLogger(__name__)


def send_payment_confirmation_email(event_registration):
    """
    Send payment confirmation email for an event registration.
    Uses the event's confirmed_email_template if available.
    Only sends to participants marked as main contact.
    """
    event = event_registration.event
    participant = event_registration.participant
    
    # Check if this participant is marked as main contact
    try:
        event_participant = event.eventparticipant_set.get(participant=participant)
        if not event_participant.is_main_contact:
            logger.info(f"Skipping email for participant {participant.email} - not marked as main contact")
            return
    except event.eventparticipant_set.model.DoesNotExist:
        logger.warning(f"EventParticipant not found for registration {event_registration.id}")
        return
    
    # Skip if no email template is configured
    if not event.confirmed_email_template or not event.confirmed_email_template.strip():
        logger.info(f"No email template configured for event {event.id}, skipping confirmation email")
        return
    
    # Prepare participant details based on registration type
    if event_registration.group:
        # This is a group registration
        group = event_registration.group
        total_participants = sum(reg.participant.quantity for reg in group.registrations.all())
        participant_details = f"""*Participant details*
Name of the main contact: {group.payer_name}
Phone number of the main contact: {group.payer_phone}
Number of participants in this order: {total_participants}"""
    else:
        # This is an individual registration
        participant_details = f"""*Participant details*
Name: {participant.first_name} {participant.last_name}
Phone number: {participant.phone_number}"""

    # Prepare template context
    context_data = {
        'first_name': participant.first_name,
        'last_name': participant.last_name,
        'email': participant.email,
        'phone_number': participant.phone_number,
        'quantity': participant.quantity,
        'event_title': event.title,
        'event_date': event.start_date.strftime('%B %d, %Y at %I:%M %p') if event.start_date else '',
        'event_location': event.location,
        'amount': str(event_registration.amount + (event_registration.donation_amount or 0)),
        'currency': event_registration.currency,
        'registration_reference': event_registration.reference,
        'participant_details': participant_details,
        'event': event,
        'participant': participant,
        'registration': event_registration,
    }
    
    try:
        # Render the email template
        template = Template(event.confirmed_email_template)
        context = Context(context_data)
        html_content = template.render(context)
        
        # Create email subject
        subject = f"Payment Confirmed - {event.title}"
        
        # Prepare email
        from_email = getattr(settings, 'OSCAR_FROM_EMAIL', settings.DEFAULT_FROM_EMAIL)
        reply_to_email = getattr(settings, 'REPLY_TO_EMAIL', None)
        
        email = EmailMultiAlternatives(
            subject=subject,
            body='',  # We'll use HTML content only
            from_email=from_email,
            to=[participant.email],
            reply_to=[reply_to_email] if reply_to_email else None,
        )
        
        # Attach HTML content
        email.attach_alternative(html_content, "text/html")
        
        # Send email
        email.send()
        logger.info(f"Payment confirmation email sent to {participant.email} for event registration {event_registration.id}")
        
    except Exception as e:
        logger.error(f"Failed to send payment confirmation email for registration {event_registration.id}: {str(e)}")
        # Don't raise the exception to avoid blocking the payment verification process


def send_group_payment_confirmation_emails(event_registration_group):
    """
    Send payment confirmation emails for all registrations in a group.
    Only sends emails to participants marked as main contact.
    """
    for registration in event_registration_group.registrations.all():
        send_payment_confirmation_email(registration)
