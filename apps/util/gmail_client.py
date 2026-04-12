import base64
import re
from datetime import datetime, timezone, timedelta
from email.utils import parseaddr
from typing import Optional

from django.conf import settings


class GmailClientError(Exception):
    pass


def _require_google_libs():
    try:
        # Lazy import to avoid hard dependency when feature is unused
        from google.oauth2.credentials import Credentials  # noqa: F401
        from google.auth.transport.requests import Request  # noqa: F401
        from googleapiclient.discovery import build  # noqa: F401
    except Exception as e:
        raise GmailClientError(
            "Google libraries not installed. Add google-api-python-client, google-auth, and google-auth-oauthlib to requirements and install."
        ) from e


def build_gmail_service():
    """
    Build an authenticated Gmail API service using OAuth2 refresh token credentials
    provided via environment variables.
    """
    _require_google_libs()
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    client_id = getattr(settings, "GMAIL_CLIENT_ID", "")
    client_secret = getattr(settings, "GMAIL_CLIENT_SECRET", "")
    refresh_token = getattr(settings, "GMAIL_REFRESH_TOKEN", "")

    if not client_id or not client_secret or not refresh_token:
        raise GmailClientError(
            "Missing Gmail credentials. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in environment/.env."
        )

    creds = Credentials(
        token=None,  # will be fetched via refresh
        refresh_token=refresh_token,
        client_id=client_id,
        client_secret=client_secret,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )

    # Ensure we have an access token now
    creds.refresh(Request())

    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    return service


def _extract_body(payload) -> str:
    """Extract and decode the email body (plain or HTML) from Gmail message payload."""

    def walk_parts(part):
        if not part:
            return []
        mime = part.get("mimeType")
        body = part.get("body", {})
        data = body.get("data")
        res = []
        if data and mime in ("text/plain", "text/html"):
            res.append(
                base64.urlsafe_b64decode(data.encode("utf-8")).decode(
                    "utf-8", errors="ignore"
                )
            )
        for p in part.get("parts", []) or []:
            res.extend(walk_parts(p))
        return res

    texts = walk_parts(payload)
    return "\n".join(texts)


def _get_headers(payload) -> dict[str, str]:
    headers = {}
    for header in payload.get("headers", []) or []:
        name = (header.get("name") or "").strip().lower()
        value = (header.get("value") or "").strip()
        if name and value:
            headers[name] = value
    return headers


def _get_allowed_sender_addresses() -> set[str]:
    raw = getattr(settings, "GMAIL_ALLOWED_FROM_ADDRESSES", "") or ""
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _get_allowed_sender_domains() -> set[str]:
    raw = getattr(settings, "GMAIL_ALLOWED_FROM_DOMAINS", "") or ""
    return {item.strip().lower().lstrip("@") for item in raw.split(",") if item.strip()}


def _sender_matches_allowlist(from_email: str) -> bool:
    default_from_email = (getattr(settings, "DEFAULT_FROM_EMAIL", "") or "").strip().lower()
    allowed_addresses = _get_allowed_sender_addresses()
    allowed_domains = _get_allowed_sender_domains()

    if not from_email:
        return False

    email_value = from_email.lower()
    dfe_extracted = re.search(r'<([^>]+)>', default_from_email)

    if default_from_email and email_value == (dfe_extracted.group(1) if dfe_extracted else default_from_email):
        return True

    if not allowed_addresses and not allowed_domains:
        return True

    if email_value in allowed_addresses:
        return True

    if "@" not in email_value:
        return False

    domain = email_value.rsplit("@", 1)[1]
    return domain in allowed_domains


def find_paynow_email_for_order(
    service,
    order_number: str,
    subject_query: Optional[str] = None,
    max_age_minutes: int = 60,
    max_results: int = 10,
) -> Optional[dict[str, str | datetime]]:
    """
    Search Gmail for a recent PayNow notification containing the given MER order number.

    Returns a dict with parsed payment details if found; otherwise None.
    """
    if not order_number:
        return None

    # Build Gmail search query
    base_q = subject_query or getattr(
        settings,
        "GMAIL_POLL_QUERY",
        'subject:"PayNow Alert - You have received a payment via PayNow" newer_than:1d',
    )
    # Include order number to narrow down if possible
    q = f'{base_q} "{order_number}"'

    now = datetime.now(timezone.utc)
    min_dt = now - timedelta(minutes=max_age_minutes)

    try:
        msgs = (
            service.users()
            .messages()
            .list(userId="me", q=q, maxResults=max_results)
            .execute()
            or {}
        )
    except Exception as e:
        raise GmailClientError(f"Error querying Gmail API: {e}") from e

    for item in msgs.get("messages") or []:
        try:
            msg = (
                service.users()
                .messages()
                .get(userId="me", id=item["id"], format="full")
                .execute()
            )
            internal_ms = int(msg.get("internalDate", 0))
            received_at = datetime.fromtimestamp(internal_ms / 1000.0, tz=timezone.utc)
            if received_at < min_dt:
                continue

            payload = msg.get("payload", {})
            headers = _get_headers(payload)
            from_header = headers.get("from", "")
            from_email = parseaddr(from_header)[1].lower()
            if not _sender_matches_allowlist(from_email):
                continue

            body_text = _extract_body(payload)
            if not body_text:
                continue

            order_match = re.search(r"OTHR-MER-([A-Za-z0-9\-]+)", body_text)
            amount_match = re.search(r"S\$\s*([\d,]+(?:\.[\d]{1,2})?)", body_text)
            if not order_match or not amount_match:
                continue

            found_order = order_match.group(1).strip()
            if found_order != order_number.strip():
                continue

            amount = amount_match.group(1).replace(",", "").strip()
            return {
                "amount": amount,
                "received_at": received_at,
                "from_header": from_header,
                "from_email": from_email,
            }
        except Exception:
            # Skip malformed message
            continue

    return None
