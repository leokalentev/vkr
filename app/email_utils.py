import smtplib
from email.message import EmailMessage

from app.config import settings


def send_student_credentials_email(
    to_email: str,
    full_name: str,
    login: str,
    password: str,
):
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP settings are not configured")

    msg = EmailMessage()
    msg["Subject"] = "Данные для входа в систему"
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email

    msg.set_content(
        f"""Здравствуйте, {full_name}!

Ваш аккаунт в системе создан.

Логин: {login}
Пароль: {password}

С уважением,
Администрация системы
"""
    )

    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)