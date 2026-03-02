"""Send emails (e.g. invitation) via Mailjet API. Optional: if Mailjet is not configured, no email is sent."""

import logging
from typing import Optional

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send"


def _mailjet_configured() -> bool:
    """True if we have Mailjet API credentials to send mail."""
    return bool(settings.MAILJET_API_KEY and settings.MAILJET_SECRET_KEY)


def send_invitation_email(
    *,
    to_email: str,
    household_name: str,
    inviter_name: Optional[str],
    accept_url: str,
) -> Optional[bool]:
    """
    Send an invitation email to join a household via Mailjet API.
    Returns True if sent, False on error, None if Mailjet is not configured (no attempt).
    """
    if not _mailjet_configured():
        logger.info("Mailjet not configured; skipping invitation email to %s", to_email)
        return None

    subject = f"You're invited to join {household_name} on Lionfish"
    inviter_line = f"{inviter_name} invited you" if inviter_name else "A household member invited you"
    body_text = (
        f"{inviter_line} to join {household_name} on Lionfish.\n\n"
        f"Accept the invitation by opening this link (log in with Google if needed):\n\n{accept_url}\n\n"
        "— Lionfish"
    )
    body_html = (
        f"<p>{inviter_line} to join <strong>{household_name}</strong> on Lionfish.</p>"
        f"<p><a href=\"{accept_url}\">Accept the invitation</a> (log in with Google if needed).</p>"
        "<p>— Lionfish</p>"
    )

    payload = {
        "Messages": [
            {
                "From": {
                    "Email": settings.MAIL_FROM,
                    "Name": settings.MAIL_FROM_NAME,
                },
                "To": [{"Email": to_email}],
                "Subject": subject,
                "TextPart": body_text,
                "HTMLPart": body_html,
            }
        ]
    }

    try:
        with httpx.Client() as client:
            r = client.post(
                MAILJET_SEND_URL,
                json=payload,
                auth=(settings.MAILJET_API_KEY, settings.MAILJET_SECRET_KEY),
                timeout=15.0,
            )
        if r.status_code != 200:
            logger.warning(
                "Mailjet API error for invitation to %s: status=%s body=%s",
                to_email,
                r.status_code,
                r.text[:500],
            )
            return False
        logger.info("Invitation email sent to %s for household %s", to_email, household_name)
        return True
    except Exception as e:
        logger.exception("Failed to send invitation email to %s: %s", to_email, e)
        return False
