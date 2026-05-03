import io
from datetime import datetime
from typing import Optional

import pandas as pd


def read_students_excel(file_bytes: bytes) -> list[dict]:
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Не удалось прочитать Excel: {str(e)}")

    df.columns = [str(col).strip().lower() for col in df.columns]

    required_columns = {"full_name", "email"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(
            f"В Excel отсутствуют обязательные колонки: {', '.join(sorted(missing))}"
        )

    students = []

    for index, row in df.iterrows():
        try:
            full_name = str(row["full_name"]).strip()
            email = str(row["email"]).strip().lower()

            if not full_name or full_name.lower() == "nan":
                raise ValueError("Пустое ФИО")

            if not email or email.lower() == "nan":
                raise ValueError("Пустой email")

            parts = full_name.split()
            if len(parts) < 2:
                raise ValueError("ФИО должно содержать минимум фамилию и имя")

            last_name = parts[0]
            first_name = parts[1]
            middle_name: Optional[str] = parts[2] if len(parts) > 2 else None

            date_of_birth = None
            if "date_of_birth" in df.columns:
                raw_dob = row["date_of_birth"]
                if pd.notna(raw_dob):
                    if isinstance(raw_dob, datetime):
                        date_of_birth = raw_dob.date()
                    else:
                        date_of_birth = pd.to_datetime(raw_dob).date()

            students.append(
                {
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "middle_name": middle_name,
                    "date_of_birth": date_of_birth,
                }
            )
        except Exception as e:
            raise ValueError(f"Ошибка в строке {index + 2}: {str(e)}")

    return students


def read_academic_snapshots_excel(file_bytes: bytes) -> list[dict]:
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Не удалось прочитать Excel: {str(e)}")

    df.columns = [str(col).strip().lower() for col in df.columns]

    VALID_EVENT_TYPES = {"Зачёт", "Экзамен"}

    required_columns = {
        "full_name",
        "email",
        "date_of_birth",
        "group_name",
        "subject_name",
        "total_classes",
        "attended_classes",
        "excused_missed_classes",
        "average_score",
    }

    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(
            f"В Excel отсутствуют обязательные колонки: {', '.join(sorted(missing))}"
        )

    rows = []

    for index, row in df.iterrows():
        try:
            full_name = str(row["full_name"]).strip()
            email = str(row["email"]).strip().lower()
            group_name = str(row["group_name"]).strip()
            subject_name = str(row["subject_name"]).strip()

            if not full_name or full_name.lower() == "nan":
                raise ValueError("Пустое ФИО")

            if not email or email.lower() == "nan":
                raise ValueError("Пустой email")

            if not group_name or group_name.lower() == "nan":
                raise ValueError("Пустое название группы")

            if not subject_name or subject_name.lower() == "nan":
                raise ValueError("Пустое название предмета")

            parts = full_name.split()
            if len(parts) < 2:
                raise ValueError("ФИО должно содержать минимум фамилию и имя")

            last_name = parts[0]
            first_name = parts[1]
            middle_name = parts[2] if len(parts) > 2 else None

            date_of_birth = None
            raw_dob = row["date_of_birth"]
            if pd.notna(raw_dob):
                if isinstance(raw_dob, datetime):
                    date_of_birth = raw_dob.date()
                else:
                    date_of_birth = pd.to_datetime(raw_dob).date()

            total_classes = int(row["total_classes"])
            attended_classes = int(row["attended_classes"])
            excused_missed_classes = int(row["excused_missed_classes"])
            average_score = float(row["average_score"])

            if total_classes < 0:
                raise ValueError("total_classes не может быть отрицательным")
            if attended_classes < 0:
                raise ValueError("attended_classes не может быть отрицательным")
            if excused_missed_classes < 0:
                raise ValueError("excused_missed_classes не может быть отрицательным")
            if attended_classes > total_classes:
                raise ValueError("attended_classes не может быть больше total_classes")
            if excused_missed_classes > total_classes:
                raise ValueError("excused_missed_classes не может быть больше total_classes")
            if attended_classes + excused_missed_classes > total_classes:
                raise ValueError("attended_classes + excused_missed_classes не может быть больше total_classes")
            if average_score < 0 or average_score > 50:
                raise ValueError("average_score должен быть в диапазоне 0..50")

            # Optional event columns
            event_type: Optional[str] = None
            event_name: Optional[str] = None

            if "event_type" in df.columns:
                raw_et = row["event_type"]
                if pd.notna(raw_et):
                    event_type = str(raw_et).strip()
                    if event_type and event_type not in VALID_EVENT_TYPES:
                        raise ValueError(
                            f"event_type должен быть одним из: {', '.join(VALID_EVENT_TYPES)}, "
                            f"получено: '{event_type}'"
                        )

            if "event_name" in df.columns:
                raw_en = row["event_name"]
                if pd.notna(raw_en):
                    event_name = str(raw_en).strip() or None

            rows.append(
                {
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "middle_name": middle_name,
                    "date_of_birth": date_of_birth,
                    "group_name": group_name,
                    "subject_name": subject_name,
                    "total_classes": total_classes,
                    "attended_classes": attended_classes,
                    "excused_missed_classes": excused_missed_classes,
                    "average_score": average_score,
                    "full_name": full_name,
                    "event_type": event_type,
                    "event_name": event_name,
                }
            )
        except Exception as e:
            raise ValueError(f"Ошибка в строке {index + 2}: {str(e)}")

    return rows