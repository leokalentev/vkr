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


def get_lessons_by_group(db: Session, group_id: int):
    return (
        db.query(models.Lesson)
        .filter(models.Lesson.group_id == group_id)
        .order_by(models.Lesson.lesson_date.desc(), models.Lesson.starts_at.desc())
        .all()
    )


def get_lessons_by_student(db: Session, student_id: int):
    group_ids = [
        membership.group_id
        for membership in db.query(models.GroupMembership)
        .filter(models.GroupMembership.student_id == student_id)
        .all()
    ]

    if not group_ids:
        return []

    return (
        db.query(models.Lesson)
        .filter(models.Lesson.group_id.in_(group_ids))
        .order_by(models.Lesson.lesson_date.desc(), models.Lesson.starts_at.desc())
        .all()
    )


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


def get_attendance_record(db: Session, lesson_id: int, student_id: int):
    return (
        db.query(models.Attendance)
        .filter(
            models.Attendance.lesson_id == lesson_id,
            models.Attendance.student_id == student_id,
        )
        .first()
    )


def create_or_update_attendance(
    db: Session,
    attendance_data: schemas.AttendanceCreate,
):
    existing = get_attendance_record(
        db,
        attendance_data.lesson_id,
        attendance_data.student_id,
    )

    if existing:
        existing.status = attendance_data.status
        existing.detected_by_cv = attendance_data.detected_by_cv
        existing.confidence = attendance_data.confidence

        db.commit()
        db.refresh(existing)
        return existing

    db_attendance = models.Attendance(
        lesson_id=attendance_data.lesson_id,
        student_id=attendance_data.student_id,
        status=attendance_data.status,
        detected_by_cv=attendance_data.detected_by_cv,
        confidence=attendance_data.confidence,
    )
    db.add(db_attendance)
    db.commit()
    db.refresh(db_attendance)
    return db_attendance


def get_attendance_by_lesson(db: Session, lesson_id: int):
    return (
        db.query(models.Attendance)
        .filter(models.Attendance.lesson_id == lesson_id)
        .all()
    )


def get_attendance_by_student(db: Session, student_id: int):
    return (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student_id)
        .all()
    )


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


def get_engagement_metric(db: Session, lesson_id: int, student_id: int):
    return (
        db.query(models.EngagementMetric)
        .filter(
            models.EngagementMetric.lesson_id == lesson_id,
            models.EngagementMetric.student_id == student_id,
        )
        .first()
    )


def get_latest_engagement_metric(db: Session, student_id: int):
    return (
        db.query(models.EngagementMetric)
        .filter(models.EngagementMetric.student_id == student_id)
        .order_by(models.EngagementMetric.computed_at.desc())
        .first()
    )


def get_active_face_template(db: Session, student_id: int):
    return (
        db.query(models.FaceTemplate)
        .filter(
            models.FaceTemplate.student_id == student_id,
            models.FaceTemplate.is_active.is_(True),
        )
        .order_by(models.FaceTemplate.created_at.desc())
        .first()
    )


def derive_grade_score_from_assessment(db: Session, lesson_id: int, student_id: int):
    assessment = get_assessment_result(db, lesson_id, student_id)
    if not assessment:
        return None

    if assessment.final_score is not None:
        return round(float(assessment.final_score), 4)

    if assessment.score is not None and assessment.max_score:
        return round(float(assessment.score) / float(assessment.max_score), 4)

    return None


def calculate_engagement_index(
    metric_data: schemas.EngagementMetricCreate,
    effective_grade_score: float | None,
):
    base_weights = {
        "presence_ratio": 0.20,
        "face_match_confidence": 0.15,
        "head_pose_forward_ratio": 0.15,
        "head_pose_variance_transformed": 0.10,
        "motion_level": 0.10,
        "frame_stability": 0.10,
        "grade_score": 0.20,
    }

    transformed_values = {
        "presence_ratio": metric_data.presence_ratio,
        "face_match_confidence": metric_data.face_match_confidence,
        "head_pose_forward_ratio": metric_data.head_pose_forward_ratio,
        "head_pose_variance_transformed": round(1 - metric_data.head_pose_variance, 4),
        "motion_level": metric_data.motion_level,
        "frame_stability": metric_data.frame_stability,
        "grade_score": effective_grade_score,
    }

    active_weights = {
        key: weight
        for key, weight in base_weights.items()
        if transformed_values.get(key) is not None
    }

    total_weight = sum(active_weights.values())
    normalized_weights = {
        key: round(weight / total_weight, 4)
        for key, weight in active_weights.items()
    }

    engagement_index = 0.0
    for key, weight in normalized_weights.items():
        engagement_index += float(transformed_values[key]) * weight

    weights_json = {
        "base_weights": base_weights,
        "normalized_weights": normalized_weights,
        "raw_values": {
            "presence_ratio": metric_data.presence_ratio,
            "face_match_confidence": metric_data.face_match_confidence,
            "head_pose_forward_ratio": metric_data.head_pose_forward_ratio,
            "head_pose_variance": metric_data.head_pose_variance,
            "motion_level": metric_data.motion_level,
            "frame_stability": metric_data.frame_stability,
            "grade_score": effective_grade_score,
        },
        "transformed_values": transformed_values,
        "notes": {
            "head_pose_variance_rule": "engagement uses 1 - head_pose_variance",
            "grade_score_source": "request_or_assessment_result",
        },
    }

    return round(engagement_index, 4), weights_json


def create_or_update_engagement_metric(
    db: Session,
    metric_data: schemas.EngagementMetricCreate,
):
    effective_grade_score = metric_data.grade_score
    if effective_grade_score is None:
        effective_grade_score = derive_grade_score_from_assessment(
            db, metric_data.lesson_id, metric_data.student_id
        )

    engagement_index, weights_json = calculate_engagement_index(
        metric_data,
        effective_grade_score,
    )

    existing = get_engagement_metric(db, metric_data.lesson_id, metric_data.student_id)

    if existing:
        existing.presence_ratio = metric_data.presence_ratio
        existing.face_match_confidence = metric_data.face_match_confidence
        existing.head_pose_forward_ratio = metric_data.head_pose_forward_ratio
        existing.head_pose_variance = metric_data.head_pose_variance
        existing.motion_level = metric_data.motion_level
        existing.frame_stability = metric_data.frame_stability
        existing.grade_score = effective_grade_score
        existing.engagement_index = engagement_index
        existing.frame_count = metric_data.frame_count
        existing.model_name = metric_data.model_name
        existing.model_version = metric_data.model_version
        existing.weights_json = weights_json

        db.commit()
        db.refresh(existing)
        return existing

    db_metric = models.EngagementMetric(
        lesson_id=metric_data.lesson_id,
        student_id=metric_data.student_id,
        presence_ratio=metric_data.presence_ratio,
        face_match_confidence=metric_data.face_match_confidence,
        head_pose_forward_ratio=metric_data.head_pose_forward_ratio,
        head_pose_variance=metric_data.head_pose_variance,
        motion_level=metric_data.motion_level,
        frame_stability=metric_data.frame_stability,
        grade_score=effective_grade_score,
        engagement_index=engagement_index,
        frame_count=metric_data.frame_count,
        model_name=metric_data.model_name,
        model_version=metric_data.model_version,
        weights_json=weights_json,
    )
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric


def get_engagement_metrics_by_lesson(db: Session, lesson_id: int):
    return (
        db.query(models.EngagementMetric)
        .filter(models.EngagementMetric.lesson_id == lesson_id)
        .all()
    )


def get_engagement_metrics_by_student(db: Session, student_id: int):
    return (
        db.query(models.EngagementMetric)
        .filter(models.EngagementMetric.student_id == student_id)
        .all()
    )


def normalize_assessment_result(result: models.AssessmentResult):
    if result.final_score is not None:
        return round(float(result.final_score), 4)

    if result.score is not None and result.max_score:
        return round(float(result.score) / float(result.max_score), 4)

    return None


def determine_engagement_level(score: float | None):
    if score is None:
        return "insufficient_data"
    if score >= 0.85:
        return "high"
    if score >= 0.70:
        return "good"
    if score >= 0.50:
        return "medium"
    return "low"


def build_student_analytics_summary(db: Session, student_id: int):
    student = get_user_by_id(db, student_id)
    groups = get_groups_by_student(db, student_id)

    attendance_records = get_attendance_by_student(db, student_id)
    attendance_weights = {
        models.AttendanceStatus.PRESENT: 1.0,
        models.AttendanceStatus.LATE: 0.7,
        models.AttendanceStatus.EXCUSED: 0.6,
        models.AttendanceStatus.ABSENT: 0.0,
    }

    total_attendance_records = len(attendance_records)
    attended_records = sum(
        1 for record in attendance_records
        if record.status in {
            models.AttendanceStatus.PRESENT,
            models.AttendanceStatus.LATE,
            models.AttendanceStatus.EXCUSED,
        }
    )

    attendance_rate_percent = None
    attendance_score = None
    if total_attendance_records > 0:
        attendance_rate_percent = round(attended_records / total_attendance_records * 100, 2)
        attendance_score = round(
            sum(attendance_weights[record.status] for record in attendance_records) / total_attendance_records,
            4,
        )

    assessment_results = get_results_by_student(db, student_id)
    academic_scores = [
        score for score in
        (normalize_assessment_result(result) for result in assessment_results)
        if score is not None
    ]

    average_academic_score = None
    if academic_scores:
        average_academic_score = round(sum(academic_scores) / len(academic_scores), 4)

    engagement_metrics = get_engagement_metrics_by_student(db, student_id)
    engagement_scores = [round(float(metric.engagement_index), 4) for metric in engagement_metrics]

    average_engagement_index = None
    if engagement_scores:
        average_engagement_index = round(sum(engagement_scores) / len(engagement_scores), 4)

    base_weights = {
        "attendance_score": 0.30,
        "average_academic_score": 0.30,
        "average_engagement_index": 0.40,
    }

    available_components = {
        "attendance_score": attendance_score,
        "average_academic_score": average_academic_score,
        "average_engagement_index": average_engagement_index,
    }

    active_weights = {
        key: weight
        for key, weight in base_weights.items()
        if available_components[key] is not None
    }

    integral_engagement_score = None
    normalized_weights = {}

    if active_weights:
        total_weight = sum(active_weights.values())
        normalized_weights = {
            key: round(weight / total_weight, 4)
            for key, weight in active_weights.items()
        }

        integral_engagement_score = round(
            sum(available_components[key] * normalized_weights[key] for key in normalized_weights),
            4,
        )

    return schemas.StudentAnalyticsSummary(
        student=student,
        groups=groups,
        total_attendance_records=total_attendance_records,
        attended_records=attended_records,
        attendance_rate_percent=attendance_rate_percent,
        attendance_score=attendance_score,
        total_assessment_results=len(assessment_results),
        average_academic_score=average_academic_score,
        total_engagement_metrics=len(engagement_metrics),
        average_engagement_index=average_engagement_index,
        integral_engagement_score=integral_engagement_score,
        engagement_level=determine_engagement_level(integral_engagement_score),
        component_weights={
            "base_weights": base_weights,
            "normalized_weights": normalized_weights,
        },
    )


def build_group_analytics_summary(db: Session, group_id: int):
    group = get_group_by_id(db, group_id)
    students = get_students_by_group(db, group_id)

    student_summaries = [
        build_student_analytics_summary(db, student.id)
        for student in students
    ]

    sorted_summaries = sorted(
        student_summaries,
        key=lambda item: item.integral_engagement_score if item.integral_engagement_score is not None else -1,
        reverse=True,
    )

    student_items = []
    for index, summary in enumerate(sorted_summaries, start=1):
        student_items.append(
            schemas.GroupStudentAnalyticsItem(
                rank=index,
                student=summary.student,
                attendance_score=summary.attendance_score,
                average_academic_score=summary.average_academic_score,
                average_engagement_index=summary.average_engagement_index,
                integral_engagement_score=summary.integral_engagement_score,
                engagement_level=summary.engagement_level,
            )
        )

    def avg_or_none(values):
        filtered = [value for value in values if value is not None]
        if not filtered:
            return None
        return round(sum(filtered) / len(filtered), 4)

    average_attendance_score = avg_or_none(
        [item.attendance_score for item in student_items]
    )
    average_academic_score = avg_or_none(
        [item.average_academic_score for item in student_items]
    )
    average_engagement_index = avg_or_none(
        [item.average_engagement_index for item in student_items]
    )
    average_integral_engagement_score = avg_or_none(
        [item.integral_engagement_score for item in student_items]
    )

    top_student = student_items[0].student if student_items else None

    return schemas.GroupAnalyticsSummary(
        group=group,
        total_students=len(students),
        average_attendance_score=average_attendance_score,
        average_academic_score=average_academic_score,
        average_engagement_index=average_engagement_index,
        average_integral_engagement_score=average_integral_engagement_score,
        top_student=top_student,
        students=student_items,
    )


def get_recommendation_by_id(db: Session, recommendation_id: int):
    return (
        db.query(models.Recommendation)
        .filter(models.Recommendation.id == recommendation_id)
        .first()
    )


def get_recommendations_by_student(db: Session, student_id: int):
    return (
        db.query(models.Recommendation)
        .filter(models.Recommendation.student_id == student_id)
        .order_by(models.Recommendation.created_at.desc())
        .all()
    )


def get_existing_recommendation(
    db: Session,
    student_id: int,
    recommendation_type: models.RecommendationType,
    title: str,
    text: str,
):
    return (
        db.query(models.Recommendation)
        .filter(
            models.Recommendation.student_id == student_id,
            models.Recommendation.recommendation_type == recommendation_type,
            models.Recommendation.title == title,
            models.Recommendation.text == text,
        )
        .first()
    )


def create_or_get_recommendation(
    db: Session,
    student_id: int,
    recommendation_type: models.RecommendationType,
    title: str,
    text: str,
    confidence_score: float | None = None,
    lesson_id: int | None = None,
):
    existing = get_existing_recommendation(
        db=db,
        student_id=student_id,
        recommendation_type=recommendation_type,
        title=title,
        text=text,
    )
    if existing:
        return existing

    recommendation = models.Recommendation(
        student_id=student_id,
        lesson_id=lesson_id,
        recommendation_type=recommendation_type,
        title=title,
        text=text,
        confidence_score=confidence_score,
        is_read=False,
    )
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)
    return recommendation


def mark_recommendation_as_read(db: Session, recommendation_id: int):
    recommendation = get_recommendation_by_id(db, recommendation_id)
    if not recommendation:
        return None

    recommendation.is_read = True
    db.commit()
    db.refresh(recommendation)
    return recommendation


def generate_recommendation_payloads(
    summary: schemas.StudentAnalyticsSummary,
    latest_metric: models.EngagementMetric | None = None,
):
    payloads = []

    level = summary.engagement_level
    academic = summary.average_academic_score
    attendance = summary.attendance_score
    engagement = summary.average_engagement_index
    integral = summary.integral_engagement_score

    presence_ratio = float(latest_metric.presence_ratio) if latest_metric and latest_metric.presence_ratio is not None else None
    face_match_confidence = (
        float(latest_metric.face_match_confidence)
        if latest_metric and latest_metric.face_match_confidence is not None
        else None
    )
    head_pose_forward_ratio = (
        float(latest_metric.head_pose_forward_ratio)
        if latest_metric and latest_metric.head_pose_forward_ratio is not None
        else None
    )
    motion_level = float(latest_metric.motion_level) if latest_metric and latest_metric.motion_level is not None else None
    frame_stability = float(latest_metric.frame_stability) if latest_metric and latest_metric.frame_stability is not None else None

    if level == "low":
        payloads.append(
            (
                models.RecommendationType.RISK,
                "Требуется усиленный контроль вовлечённости",
                "Система зафиксировала низкий общий уровень вовлечённости. Рекомендуется провести индивидуальную беседу, выяснить причины снижения активности и организовать более частый контроль прогресса.",
                0.95,
            )
        )

        if attendance is not None and attendance < 0.5:
            payloads.append(
                (
                    models.RecommendationType.ACTIVITY,
                    "Нужно повысить дисциплину посещения",
                    "Низкий показатель посещаемости снижает общий результат. Желательно усилить контроль присутствия на контрольных мероприятиях и оперативно реагировать на пропуски.",
                    0.92,
                )
            )

        if academic is not None and academic < 0.6:
            payloads.append(
                (
                    models.RecommendationType.ACADEMIC,
                    "Требуется адресная учебная поддержка",
                    "Учебный результат ниже ожидаемого. Рекомендуется организовать дополнительные консультации, разобрать проблемные темы и дать короткие задания для закрепления материала.",
                    0.90,
                )
            )

        if head_pose_forward_ratio is not None and head_pose_forward_ratio < 0.5:
            payloads.append(
                (
                    models.RecommendationType.MOTIVATION,
                    "Стоит усилить включённость в работу на мероприятии",
                    "Последний анализ показал слабую устойчивость внимания во время мероприятия. Полезно чаще вовлекать студента в устные ответы, короткие вопросы и практические действия по ходу работы.",
                    0.84,
                )
            )

    elif level == "medium":
        payloads.append(
            (
                models.RecommendationType.ACTIVITY,
                "Нужно закрепить рабочую вовлечённость",
                "Уровень вовлечённости остаётся средним. Желательно чаще включать студента в активные формы участия и давать более регулярную обратную связь по результатам.",
                0.82,
            )
        )

        if academic is not None and academic < 0.7:
            payloads.append(
                (
                    models.RecommendationType.ACADEMIC,
                    "Желательна точечная работа по сложным темам",
                    "При среднем уровне вовлечённости учебный результат остаётся недостаточно высоким. Рекомендуется определить проблемные темы и усилить их отработку.",
                    0.80,
                )
            )

        if head_pose_forward_ratio is not None and head_pose_forward_ratio < 0.65:
            payloads.append(
                (
                    models.RecommendationType.MOTIVATION,
                    "Нужно поддерживать устойчивое внимание",
                    "Во время последнего анализа внимание студента было нестабильным. Полезно использовать более частые контрольные вопросы и короткие этапы проверки понимания.",
                    0.76,
                )
            )

        if frame_stability is not None and frame_stability < 0.6:
            payloads.append(
                (
                    models.RecommendationType.ACTIVITY,
                    "Следует повысить устойчивость поведения на мероприятии",
                    "Последний анализ показал нестабильное поведение в кадре. Рекомендуется усилить организационную дисциплину и поддерживать более чёткий формат работы на контрольном мероприятии.",
                    0.74,
                )
            )

    elif level == "good":
        payloads.append(
            (
                models.RecommendationType.ACADEMIC,
                "Стоит поддерживать текущий уровень работы",
                "Студент демонстрирует хороший общий уровень вовлечённости. Рекомендуется сохранять текущий формат сопровождения и постепенно усложнять учебные задачи.",
                0.75,
            )
        )

        if academic is not None and academic >= 0.85:
            payloads.append(
                (
                    models.RecommendationType.ACADEMIC,
                    "Можно расширять сложность заданий",
                    "Учебный результат устойчиво высокий. Есть основания постепенно увеличивать сложность практических и контрольных заданий.",
                    0.73,
                )
            )

        if head_pose_forward_ratio is not None and head_pose_forward_ratio < 0.7:
            payloads.append(
                (
                    models.RecommendationType.ACTIVITY,
                    "Полезно поддерживать концентрацию на протяжении мероприятия",
                    "Несмотря на хороший общий результат, признаки устойчивого внимания в последнем анализе были не максимальными. Желательно чаще удерживать студента в активной фазе работы.",
                    0.71,
                )
            )

    elif level == "high":
        payloads.append(
            (
                models.RecommendationType.ACADEMIC,
                "Можно предлагать задания повышенной сложности",
                "Студент демонстрирует высокий уровень вовлечённости и устойчивое участие в образовательном процессе. Рекомендуется использовать более сложные задания, элементы проектной работы и расширенные учебные цели.",
                0.78,
            )
        )

        payloads.append(
            (
                models.RecommendationType.MOTIVATION,
                "Следует поддерживать достигнутый высокий уровень",
                "Текущие показатели свидетельствуют о хорошей включённости студента в процесс. Полезно закреплять результат через персонализированные цели и регулярное позитивное подкрепление.",
                0.74,
            )
        )

        if academic is not None and academic < 0.75:
            payloads.append(
                (
                    models.RecommendationType.ACADEMIC,
                    "Высокую вовлечённость стоит подкрепить ростом учебного результата",
                    "Студент активно включён в процесс, однако академический результат пока ниже ожидаемого. Рекомендуется направить активность в более содержательную учебную работу по трудным темам.",
                    0.79,
                )
            )

        if head_pose_forward_ratio is not None and head_pose_forward_ratio >= 0.75:
            payloads.append(
                (
                    models.RecommendationType.ACTIVITY,
                    "Во время мероприятия зафиксирована устойчивая концентрация",
                    "Последний видеоанализ показал хорошую устойчивость внимания и уверенное присутствие студента. Такой формат участия можно считать положительным ориентиром.",
                    0.72,
                )
            )

    else:
        payloads.append(
            (
                models.RecommendationType.MOTIVATION,
                "Недостаточно данных для развёрнутых рекомендаций",
                "Для более точного вывода системе требуется больше данных по посещаемости, учебным результатам и видеоанализу контрольных мероприятий.",
                0.55,
            )
        )

    if presence_ratio is not None and presence_ratio < 0.75:
        payloads.append(
            (
                models.RecommendationType.ACTIVITY,
                "Присутствие на последнем мероприятии было зафиксировано нестабильно",
                "Видеоанализ показал, что студент присутствовал в кадре не на всём протяжении мероприятия. Рекомендуется дополнительно контролировать условия проведения и факт участия.",
                0.77,
            )
        )

    if face_match_confidence is not None and face_match_confidence < 0.65:
        payloads.append(
            (
                models.RecommendationType.RISK,
                "Есть смысл дополнительно подтвердить личность участника",
                "Уверенность автоматического распознавания личности оказалась ниже желаемой. Желательно использовать более качественный видеоматериал или повторную проверку шаблона лица.",
                0.70,
            )
        )

    if motion_level is not None and motion_level > 0.35:
        payloads.append(
            (
                models.RecommendationType.ACTIVITY,
                "Во время последнего анализа зафиксирована повышенная двигательная активность",
                "Система выявила заметную подвижность в кадре. Это может снижать устойчивость внимания, поэтому полезно поддерживать более организованный формат участия в мероприятии.",
                0.68,
            )
        )

    return payloads


def generate_recommendations_for_student(db: Session, student_id: int):
    summary = build_student_analytics_summary(db, student_id)
    latest_metric = get_latest_engagement_metric(db, student_id)
    payloads = generate_recommendation_payloads(summary, latest_metric)

    recommendations = []
    for recommendation_type, title, text, confidence_score in payloads:
        recommendation = create_or_get_recommendation(
            db=db,
            student_id=student_id,
            recommendation_type=recommendation_type,
            title=title,
            text=text,
            confidence_score=confidence_score,
            lesson_id=latest_metric.lesson_id if latest_metric else None,
        )
        recommendations.append(recommendation)

    return schemas.StudentRecommendationsGenerationResponse(
        student_id=student_id,
        integral_engagement_score=summary.integral_engagement_score,
        engagement_level=summary.engagement_level,
        generated_count=len(recommendations),
        recommendations=recommendations,
    )


def generate_recommendations_for_group(db: Session, group_id: int):
    students = get_students_by_group(db, group_id)

    total_generated = 0
    for student in students:
        response = generate_recommendations_for_student(db, student.id)
        total_generated += response.generated_count

    return schemas.GroupRecommendationsGenerationResponse(
        group_id=group_id,
        total_students=len(students),
        total_generated_recommendations=total_generated,
    )