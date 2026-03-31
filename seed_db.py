from datetime import datetime, date, timezone

from app.database import Base, engine, SessionLocal
from app import models
from app.security import hash_password


def seed():
    print("Удаляем таблицы...")
    Base.metadata.drop_all(bind=engine)

    print("Создаём таблицы заново...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        print("Добавляем пользователей...")

        admin = models.User(
            email="admin1@example.com",
            password_hash=hash_password("admin123"),
            first_name="Алексей",
            last_name="Админов",
            middle_name="Игоревич",
            role=models.UserRole.ADMIN,
            is_active=True,
        )

        teacher = models.User(
            email="teacher1@example.com",
            password_hash=hash_password("teacher123"),
            first_name="Мария",
            last_name="Петрова",
            middle_name="Сергеевна",
            role=models.UserRole.TEACHER,
            is_active=True,
        )

        student1 = models.User(
            email="student1@example.com",
            password_hash=hash_password("student123"),
            first_name="Иван",
            last_name="Иванов",
            middle_name="Иванович",
            role=models.UserRole.STUDENT,
            is_active=True,
        )

        student2 = models.User(
            email="student2@example.com",
            password_hash=hash_password("student123"),
            first_name="Пётр",
            last_name="Сидоров",
            middle_name="Алексеевич",
            role=models.UserRole.STUDENT,
            is_active=True,
        )

        db.add_all([admin, teacher, student1, student2])
        db.commit()

        db.refresh(admin)
        db.refresh(teacher)
        db.refresh(student1)
        db.refresh(student2)

        print("Добавляем профили студентов...")

        profile1 = models.StudentProfile(
            user_id=student1.id,
            student_identifier="STU001",
            date_of_birth=date(2005, 5, 12),
            interests="Математика, программирование",
            notes="Активный студент",
        )

        profile2 = models.StudentProfile(
            user_id=student2.id,
            student_identifier="STU002",
            date_of_birth=date(2005, 8, 20),
            interests="Информатика, аналитика данных",
            notes="Требует дополнительной мотивации",
        )

        db.add_all([profile1, profile2])
        db.commit()

        print("Добавляем группу...")

        group = models.Group(
            name="ИС-202",
            curator_id=teacher.id,
        )
        db.add(group)
        db.commit()
        db.refresh(group)

        print("Добавляем студентов в группу...")

        membership1 = models.GroupMembership(
            group_id=group.id,
            student_id=student1.id,
        )

        membership2 = models.GroupMembership(
            group_id=group.id,
            student_id=student2.id,
        )

        db.add_all([membership1, membership2])
        db.commit()

        print("Добавляем занятие...")

        lesson = models.Lesson(
            group_id=group.id,
            teacher_id=teacher.id,
            title="Практика по Python",
            lesson_date=date(2026, 3, 31),
            starts_at=datetime(2026, 3, 31, 9, 0, 0, tzinfo=timezone.utc),
            ends_at=datetime(2026, 3, 31, 10, 30, 0, tzinfo=timezone.utc),
            location="Аудитория 101",
            description="Практическое занятие по работе с FastAPI",
        )
        db.add(lesson)
        db.commit()
        db.refresh(lesson)

        print("Добавляем посещаемость...")

        attendance1 = models.Attendance(
            lesson_id=lesson.id,
            student_id=student1.id,
            status=models.AttendanceStatus.PRESENT,
            detected_by_cv=False,
            confidence=None,
        )

        attendance2 = models.Attendance(
            lesson_id=lesson.id,
            student_id=student2.id,
            status=models.AttendanceStatus.ABSENT,
            detected_by_cv=False,
            confidence=None,
        )

        db.add_all([attendance1, attendance2])
        db.commit()

        print("Добавляем результаты оценивания...")

        result1 = models.AssessmentResult(
            lesson_id=lesson.id,
            student_id=student1.id,
            score=90,
            max_score=100,
            grade_label="excellent",
            attendance_weight=0.2,
            academic_weight=0.5,
            engagement_weight=0.3,
            final_score=0.90,
            teacher_comment="Отличная работа",
        )

        result2 = models.AssessmentResult(
            lesson_id=lesson.id,
            student_id=student2.id,
            score=65,
            max_score=100,
            grade_label="satisfactory",
            attendance_weight=0.2,
            academic_weight=0.5,
            engagement_weight=0.3,
            final_score=0.65,
            teacher_comment="Нужно повысить активность",
        )

        db.add_all([result1, result2])
        db.commit()

        print("Готово.")
        print()
        print("Тестовые аккаунты:")
        print("ADMIN   -> admin1@example.com / admin123")
        print("TEACHER -> teacher1@example.com / teacher123")
        print("STUDENT -> student1@example.com / student123")
        print("STUDENT -> student2@example.com / student123")

    finally:
        db.close()


if __name__ == "__main__":
    seed()