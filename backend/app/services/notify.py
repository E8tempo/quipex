import html
import logging
from email.message import EmailMessage

import aiosmtplib
import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


async def send_telegram(text: str) -> None:
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        return
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                url,
                json={
                    "chat_id": settings.telegram_chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
    except Exception:  # noqa: BLE001
        log.exception("Telegram notification failed")


async def send_email(subject: str, body: str, to: str | None = None) -> None:
    recipient = to or settings.notify_email
    if not (settings.smtp_host and recipient):
        return
    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user or recipient
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            use_tls=settings.smtp_use_tls and settings.smtp_port == 465,
            start_tls=settings.smtp_use_tls and settings.smtp_port != 465,
            timeout=15,
        )
    except Exception:  # noqa: BLE001
        log.exception("Email notification failed")


async def notify(subject: str, lines: list[str]) -> None:
    """Отправить уведомление менеджеру во все настроенные каналы."""
    plain = "\n".join(lines)
    tg = f"<b>{html.escape(subject)}</b>\n" + "\n".join(html.escape(line) for line in lines)
    await send_telegram(tg)
    await send_email(subject, plain)
