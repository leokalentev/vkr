from sqlalchemy import text

from app.database import SessionLocal


# ЗАМЕНИ, если у тебя другие email
KEEP_EMAILS = [
    "teacher1@example.com",
    "admin1@example.com",
]


def reset_sequences(db):
    table_names = [
        "users",
        "groups",
        "lessons",
        "attendance",
        "engagement_metrics",
        "assessment_results",
        "face_templates",
        "recommendations",
        "student_academic_snapshots",
    ]

    for table_name in table_names:
        seq_sql = text(
            """
            SELECT pg_get_serial_sequence(:table_name, 'id')
            """
        )
        seq_name = db.execute(seq_sql, {"table_name": table_name}).scalar()

        if not seq_name:
            continue

        max_id_sql = text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")
        max_id = db.execute(max_id_sql).scalar() or 0

        if max_id == 0:
            db.execute(
                text("SELECT setval(:seq_name, 1, false)"),
                {"seq_name": seq_name},
            )
        else:
            db.execute(
                text("SELECT setval(:seq_name, :max_id, true)"),
                {"seq_name": seq_name, "max_id": max_id},
            )


def main():
    db = SessionLocal()

    try:
        # Проверим, что нужные аккаунты вообще есть
        existing_staff = db.execute(
            text(
                """
                SELECT id, email, role
                FROM users
                WHERE email = ANY(:emails)
                ORDER BY id
                """
            ),
            {"emails": KEEP_EMAILS},
        ).fetchall()

        if len(existing_staff) != len(KEEP_EMAILS):
            found = {row.email for row in existing_staff}
            missing = [email for email in KEEP_EMAILS if email not in found]
            raise RuntimeError(
                f"Не найдены аккаунты, которые нужно сохранить: {missing}"
            )

        print("Будут сохранены аккаунты:")
        for row in existing_staff:
            print(f"  id={row.id}, email={row.email}, role={row.role}")

        # 1. Полностью очищаем все зависимые таблицы
        db.execute(text("DELETE FROM recommendations"))
        db.execute(text("DELETE FROM face_templates"))
        db.execute(text("DELETE FROM engagement_metrics"))
        db.execute(text("DELETE FROM attendance"))
        db.execute(text("DELETE FROM assessment_results"))
        db.execute(text("DELETE FROM student_academic_snapshots"))
        db.execute(text("DELETE FROM lessons"))
        db.execute(text("DELETE FROM group_memberships"))
        db.execute(text("DELETE FROM groups"))

        # 2. Удаляем student_profile у всех студентов
        db.execute(
            text(
                """
                DELETE FROM student_profiles
                WHERE user_id IN (
                    SELECT id FROM users
                    WHERE email <> ALL(:emails)
                )
                """
            ),
            {"emails": KEEP_EMAILS},
        )

        # 3. Удаляем всех пользователей, кроме учителя и админа
        db.execute(
            text(
                """
                DELETE FROM users
                WHERE email <> ALL(:emails)
                """
            ),
            {"emails": KEEP_EMAILS},
        )

        # 4. Сбрасываем sequence
        reset_sequences(db)

        db.commit()
        print("База успешно очищена.")
        print("Оставлены только выбранные аккаунты учителя и администратора.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()