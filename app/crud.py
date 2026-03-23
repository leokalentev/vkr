from sqlalchemy.orm import Session, joinedload

from app import models, schemas


def create_user(db: Session, user: schemas.UserCreate, password_hash: str):
    db_user = models.User(
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        role=user.role,
        password_hash=password_hash,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def create_user_with_hashed_password(db: Session, user_data, password_hash: str):
    db_user = models.User(
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        middle_name=user_data.middle_name,
        role=user_data.role,
        password_hash=password_hash,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_users(db: Session):
    return db.query(models.User).all()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def authenticate_user(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_group(db: Session, group: schemas.GroupCreate):
    db_group = models.Group(
        name=group.name,
        curator_id=group.curator_id
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_groups(db: Session):
    return db.query(models.Group).all()


def get_group_by_id(db: Session, group_id: int):
    return db.query(models.Group).filter(models.Group.id == group_id).first()


def create_lesson(db: Session, lesson: schemas.LessonCreate):
    db_lesson = models.Lesson(
        group_id=lesson.group_id,
        teacher_id=lesson.teacher_id,
        title=lesson.title,
        lesson_date=lesson.lesson_date,
        starts_at=lesson.starts_at,
        ends_at=lesson.ends_at,
        location=lesson.location,
        description=lesson.description,
    )
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    return db_lesson


def get_lessons(db: Session):
    return db.query(models.Lesson).all()


def get_lesson_by_id(db: Session, lesson_id: int):
    return db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()


def get_group_membership(db: Session, group_id: int, student_id: int):
    return (
        db.query(models.GroupMembership)
        .filter(
            models.GroupMembership.group_id == group_id,
            models.GroupMembership.student_id == student_id,
        )
        .first()
    )


def add_student_to_group(db: Session, group_id: int, student_id: int):
    group = get_group_by_id(db, group_id)
    if not group:
        return None, "group_not_found"

    student = get_user_by_id(db, student_id)
    if not student:
        return None, "student_not_found"

    if student.role != models.UserRole.STUDENT:
        return None, "user_is_not_student"

    existing = get_group_membership(db, group_id, student_id)
    if existing:
        return None, "already_in_group"

    membership = models.GroupMembership(
        group_id=group_id,
        student_id=student_id,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership, None


def get_students_by_group(db: Session, group_id: int):
    memberships = (
        db.query(models.GroupMembership)
        .options(joinedload(models.GroupMembership.student))
        .filter(models.GroupMembership.group_id == group_id)
        .all()
    )
    return [m.student for m in memberships]


def get_groups_by_student(db: Session, student_id: int):
    memberships = (
        db.query(models.GroupMembership)
        .options(joinedload(models.GroupMembership.group))
        .filter(models.GroupMembership.student_id == student_id)
        .all()
    )
    return [m.group for m in memberships]


def create_student_with_profile(
    db: Session,
    email: str,
    password_hash: str,
    first_name: str,
    last_name: str,
    middle_name: str | None = None,
    date_of_birth=None,
):
    db_user = models.User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        middle_name=middle_name,
        role=models.UserRole.STUDENT,
        password_hash=password_hash,
        is_active=True,
    )
    db.add(db_user)
    db.flush()

    student_identifier = f"student-{db_user.id}"

    db_profile = models.StudentProfile(
        user_id=db_user.id,
        student_identifier=student_identifier,
        date_of_birth=date_of_birth,
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_user)

    return db_user


def get_assessment_result(db: Session, lesson_id: int, student_id: int):
    return (
        db.query(models.AssessmentResult)
        .filter(
            models.AssessmentResult.lesson_id == lesson_id,
            models.AssessmentResult.student_id == student_id,
        )
        .first()
    )


def create_or_update_assessment_result(
    db: Session,
    result_data: schemas.AssessmentResultCreate,
):
    existing = get_assessment_result(db, result_data.lesson_id, result_data.student_id)

    if existing:
        existing.score = result_data.score
        existing.max_score = result_data.max_score
        existing.grade_label = result_data.grade_label
        existing.attendance_weight = result_data.attendance_weight
        existing.academic_weight = result_data.academic_weight
        existing.engagement_weight = result_data.engagement_weight
        existing.final_score = result_data.final_score
        existing.teacher_comment = result_data.teacher_comment

        db.commit()
        db.refresh(existing)
        return existing

    db_result = models.AssessmentResult(
        lesson_id=result_data.lesson_id,
        student_id=result_data.student_id,
        score=result_data.score,
        max_score=result_data.max_score,
        grade_label=result_data.grade_label,
        attendance_weight=result_data.attendance_weight,
        academic_weight=result_data.academic_weight,
        engagement_weight=result_data.engagement_weight,
        final_score=result_data.final_score,
        teacher_comment=result_data.teacher_comment,
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return db_result


def get_results_by_lesson(db: Session, lesson_id: int):
    return (
        db.query(models.AssessmentResult)
        .filter(models.AssessmentResult.lesson_id == lesson_id)
        .all()
    )


def get_results_by_student(db: Session, student_id: int):
    return (
        db.query(models.AssessmentResult)
        .filter(models.AssessmentResult.student_id == student_id)
        .all()
    )