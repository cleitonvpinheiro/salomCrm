"""Single-use password reset tokens and SMTP delivery."""

import os
import smtplib
from email.message import EmailMessage
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

from models.salon import utcnow


def recovery_is_configured() -> bool:
    required = ("SMTP_HOST", "SMTP_FROM_EMAIL", "PUBLIC_APP_URL")
    if any(not os.environ.get(key, "").strip() for key in required):
        return False
    port = os.environ.get("SMTP_PORT", "587").strip()
    return port.isdigit() and 1 <= int(port) <= 65535


def _recovery_url(token: str, account_type: str, tenant_slug: str | None) -> str:
    base_url = os.environ.get("PUBLIC_APP_URL", "").rstrip("/")
    parsed = urlsplit(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError("PUBLIC_APP_URL must be an absolute HTTP(S) URL")
    query = {"token": token, "type": account_type}
    if tenant_slug:
        query["tenant"] = tenant_slug
    return f"{base_url}/reset-password?{urlencode(query)}"


def send_password_reset_email(
    email: str,
    token: str,
    account_type: str,
    tenant_slug: str | None = None,
) -> None:
    if not recovery_is_configured():
        raise RuntimeError("Password recovery email is not configured")

    reset_url = _recovery_url(token, account_type, tenant_slug)
    message = EmailMessage()
    message["Subject"] = "Redefinição de senha do Atelier"
    message["From"] = os.environ["SMTP_FROM_EMAIL"].strip()
    message["To"] = email
    message.set_content(
        "Recebemos uma solicitação para redefinir a senha da sua conta Atelier.\n\n"
        f"Use este link em até 30 minutos: {reset_url}\n\n"
        "Se você não solicitou a redefinição, ignore esta mensagem."
    )

    host = os.environ["SMTP_HOST"].strip()
    port = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ.get("SMTP_USERNAME", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    if bool(username) != bool(password):
        raise RuntimeError("SMTP_USERNAME and SMTP_PASSWORD must be set together")

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
            if username:
                smtp.login(username, password)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.starttls()
            if username:
                smtp.login(username, password)
            smtp.send_message(message)


def reset_token_expiry():
    return utcnow() + timedelta(minutes=30)
