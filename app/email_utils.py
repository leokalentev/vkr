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


def send_student_report_email(
    to_email: str,
    full_name: str,
    attendance_attended: int,
    attendance_total: int,
    attendance_pct: float | None,
    journal_score: float | None,
    exam_score: float | None,
    total_score: float | None,
    teacher_name: str = "",
):
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP settings are not configured")

    attendance_line = (
        f"{attendance_attended} из {attendance_total} занятий "
        f"({attendance_pct:.1f}%)" if attendance_pct is not None
        else f"{attendance_attended} из {attendance_total} занятий"
    )
    journal_line = f"{journal_score:.1f} / 50" if journal_score is not None else "нет данных"
    exam_line    = f"{exam_score:.1f} / 50"    if exam_score is not None    else "не выставлен"
    total_line   = f"{total_score:.1f} / 100"  if total_score is not None   else "нет данных"

    teacher_line = f"\nОтправлено преподавателем: {teacher_name}" if teacher_name else ""

    msg = EmailMessage()
    msg["Subject"] = "Ваша статистика успеваемости"
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email

    msg.set_content(
        f"""Здравствуйте, {full_name}!

Ваши текущие показатели в системе:

Посещаемость:    {attendance_line}
Балл по журналу: {journal_line}
Балл за экзамен: {exam_line}
Итоговый балл:   {total_line}
{teacher_line}

С уважением,
Информационная система анализа активности и вовлечённости студентов
"""
    )

    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)