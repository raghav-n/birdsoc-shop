from django.conf import settings
from django.core.mail import EmailMultiAlternatives, EmailMessage
from oscar.apps.communication.utils import Dispatcher as CoreDispatcher


class Dispatcher(CoreDispatcher):
    def send_email_messages(
        self,
        recipient_email,
        messages,
        from_email=None,
        reply_to_email=None,
        attachments=None,
    ):
        from_email = from_email or settings.OSCAR_FROM_EMAIL

        if from_email == settings.OSCAR_FROM_EMAIL:
            reply_to_email = reply_to_email or settings.REPLY_TO_EMAIL

        content_attachments, file_attachments = self.prepare_attachments(attachments)

        # Determine whether we are sending a HTML version too
        if messages["html"]:
            email = EmailMultiAlternatives(
                messages["subject"],
                messages["body"],
                from_email=from_email,
                to=[recipient_email],
                reply_to=[reply_to_email],
                attachments=content_attachments,
            )
            email.attach_alternative(messages["html"], "text/html")
        else:
            email = EmailMessage(
                messages["subject"],
                messages["body"],
                from_email=from_email,
                to=[recipient_email],
                reply_to=[reply_to_email],
                attachments=content_attachments,
            )
        for attachment in file_attachments:
            email.attach_file(attachment)

        self.logger.info("Sending email to %s", recipient_email)

        if self.mail_connection:
            self.mail_connection.send_messages([email])
        else:
            email.send()

        return email
