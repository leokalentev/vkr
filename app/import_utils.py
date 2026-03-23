from datetime import date, datetime
from io import BytesIO


REQUIRED_COLUMNS = {"full_name", "email"}


def parse_full_name(full_name: str) -> tuple[str, str, str | None]:
    parts = full_name.strip().split()

    if len(parts) < 2:
        raise ValueError(f"Invalid full_name: {full_name}")

    last_name = parts[0]
    first_name = parts[1]
    middle_name = parts[2] if len(parts) > 2 else None

    return first_name, last_name, middle_name


def parse_date_of_birth(value) -> date | None:
    import pandas as pd

    if value is None or pd.isna(value):
        return None

    if isinstance(value, date) and not isinstance(value, datetime):
        return value

    if isinstance(value, datetime):
        return value.date()

    value_str = str(value).strip()
    if not value_str:
        return None

    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value_str, fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Invalid date_of_birth: {value}")


def read_students_excel(file_bytes: bytes) -> list[dict]:
    import pandas as pd

    df = pd.read_excel(BytesIO(file_bytes), engine="openpyxl")
    df.columns = [str(col).strip().lower() for col in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    students = []

    for _, row in df.iterrows():
        full_name = str(row.get("full_name", "")).strip()
        email = str(row.get("email", "")).strip().lower()
        dob_raw = row.get("date_of_birth")

        if not full_name or not email or email == "nan":
            continue

        first_name, last_name, middle_name = parse_full_name(full_name)
        date_of_birth = parse_date_of_birth(dob_raw)

        students.append(
            {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "middle_name": middle_name,
                "date_of_birth": date_of_birth,
            }
        )

    return students