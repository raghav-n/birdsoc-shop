#!/usr/bin/env python3
import os
from pathlib import Path

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow


SCOPES_READ = ["https://www.googleapis.com/auth/gmail.readonly"]
SCOPES_SEND = ["https://www.googleapis.com/auth/gmail.send"]


def main():
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "send"
    if mode not in ("read", "send"):
        raise SystemExit("Usage: generate_gmail_refresh_token.py [read|send]")

    scopes = SCOPES_SEND if mode == "send" else SCOPES_READ
    env_key = "GMAIL_SEND_REFRESH_TOKEN" if mode == "send" else "GMAIL_REFRESH_TOKEN"

    project_root = Path(__file__).resolve().parent.parent
    load_dotenv(project_root / ".env")

    client_id = os.environ.get("GMAIL_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GMAIL_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        raise SystemExit(
            "Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env."
        )

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [
                "http://localhost",
                "http://localhost:8080/",
                "http://127.0.0.1",
                "http://127.0.0.1:8080/",
            ],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, scopes)
    creds = flow.run_local_server(
        host="127.0.0.1",
        port=0,
        open_browser=True,
        authorization_prompt_message=(
            "Open this URL in your browser if it does not open automatically:\n{url}\n"
        ),
        success_message="Authentication complete. You can close this window.",
        access_type="offline",
        prompt="consent",
    )

    if not creds.refresh_token:
        raise SystemExit(
            "Google did not return a refresh token. Revoke the app's access for this "
            "Google account and run the script again."
        )

    print("\nNew Gmail refresh token:\n")
    print(creds.refresh_token)
    print("\nUpdate .env with:")
    print(f"{env_key}={creds.refresh_token}")


if __name__ == "__main__":
    main()
