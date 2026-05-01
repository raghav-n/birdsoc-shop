import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class GmailApiEmailBackend(BaseEmailBackend):
    """
    Django email backend that sends via the Gmail API using OAuth2 credentials
    for sales@birdsociety.sg (GMAIL_SEND_REFRESH_TOKEN).
    """

    def open(self):
        pass

    def close(self):
        pass

    def send_messages(self, email_messages):
        from apps.util.gmail_client import build_gmail_send_service, GmailClientError

        if not email_messages:
            return 0

        try:
            service = build_gmail_send_service()
        except GmailClientError as e:
            if not self.fail_silently:
                raise
            logger.error("GmailApiEmailBackend: could not build send service: %s", e)
            return 0

        sent = 0
        for message in email_messages:
            try:
                raw = _build_raw_message(message)
                service.users().messages().send(
                    userId="me", body={"raw": raw}
                ).execute()
                sent += 1
            except Exception as e:
                logger.error("GmailApiEmailBackend: failed to send to %s: %s", message.to, e)
                if not self.fail_silently:
                    raise
        return sent


def _build_raw_message(email_message) -> str:
    if email_message.alternatives:
        mime = MIMEMultipart("alternative")
        mime.attach(MIMEText(email_message.body, "plain", "utf-8"))
        for content, mimetype in email_message.alternatives:
            maintype, subtype = mimetype.split("/", 1)
            mime.attach(MIMEText(content, subtype, "utf-8"))
    elif email_message.attachments:
        mime = MIMEMultipart("mixed")
        mime.attach(MIMEText(email_message.body, "plain", "utf-8"))
    else:
        mime = MIMEText(email_message.body, "plain", "utf-8")

    mime["Subject"] = email_message.subject
    mime["From"] = email_message.from_email
    mime["To"] = ", ".join(email_message.to)
    if email_message.cc:
        mime["Cc"] = ", ".join(email_message.cc)
    if email_message.bcc:
        mime["Bcc"] = ", ".join(email_message.bcc)
    if email_message.reply_to:
        mime["Reply-To"] = ", ".join(email_message.reply_to)
    if email_message.extra_headers:
        for key, val in email_message.extra_headers.items():
            mime[key] = val

    if email_message.attachments:
        for attachment in email_message.attachments:
            filename, content, mimetype = attachment
            maintype, subtype = mimetype.split("/", 1)
            part = MIMEBase(maintype, subtype)
            part.set_payload(content if isinstance(content, bytes) else content.encode())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            mime.attach(part)

    raw_bytes = mime.as_bytes()
    return base64.urlsafe_b64encode(raw_bytes).decode("utf-8")
