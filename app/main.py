from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app import crud, schemas, models
from app.auth import (
    router as auth_router,
    get_current_active_user,
    require_roles,
)
from app.security import hash_password
from app.import_utils import read_students_excel
from cv_module.service import analyze_video_file
from cv_module.config import TEMPLATES_DIR


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Student Engagement System API",
    description="Backend for student activity and engagement analysis system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@app.get("/")
def root():
    return {"message": "API is running"}


# =========================
# USERS
# =========================

@app.post("/users/", response_model=schemas.UserRead)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(models.UserRole.ADMIN)),
):
    existing_user = crud.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = hash_password(user.password)
    return crud.create_user(db, user, password_hash)


@app.get("/users/", response_model=list[schemas.UserRead])
def read_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(models.UserRole.ADMIN)),
):
    return crud.get_users(db)


# =========================
# GROUPS
# =========================

@app.post("/groups/", response_model=schemas.GroupRead)
def create_group(
    group: schemas.GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    curator_id = group.curator_id

    if current_user.role == models.UserRole.TEACHER:
        curator_id = current_user.id

    if current_user.role == models.UserRole.ADMIN and curator_id is not None:
        curator = crud.get_user_by_id(db, curator_id)
        if not curator:
            raise HTTPException(status_code=404, detail="Curator not found")
        if curator.role != models.UserRole.TEACHER:
            raise HTTPException(status_code=400, detail="Curator must be a teacher")

    group_to_create = schemas.GroupCreate(
        name=group.name,
        curator_id=curator_id,
    )

    return crud.create_group(db, group_to_create)


@app.get("/groups/", response_model=list[schemas.GroupRead])
def read_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_groups(db)


# =========================
# GROUP MEMBERSHIPS
# =========================

@app.post("/groups/{group_id}/students/{student_id}", response_model=schemas.GroupMembershipRead)
def add_student_to_group(
    group_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    membership, error = crud.add_student_to_group(db, group_id, student_id)

    if error == "group_not_found":
        raise HTTPException(status_code=404, detail="Group not found")
    if error == "student_not_found":
        raise HTTPException(status_code=404, detail="Student not found")
    if error == "user_is_not_student":
        raise HTTPException(status_code=400, detail="User is not a student")
    if error == "already_in_group":
        raise HTTPException(status_code=400, detail="Student already in group")

    return membership


@app.get("/groups/{group_id}/students", response_model=list[schemas.StudentShortRead])
def get_group_students(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return crud.get_students_by_group(db, group_id)


@app.get("/students/{student_id}/groups", response_model=list[schemas.GroupShortRead])
def get_student_groups(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return crud.get_groups_by_student(db, student_id)


# =========================
# IMPORT STUDENTS FROM EXCEL
# =========================

@app.post(
    "/groups/{group_id}/import-students",
    response_model=schemas.ImportStudentsResponse,
)
def import_students_to_group(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is missing")

    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")

    try:
        file_bytes = file.file.read()
        students_data = read_students_excel(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")

    imported_students = []

    for student_data in students_data:
        existing_user = crud.get_user_by_email(db, student_data["email"])

        if existing_user:
            student_user = existing_user
            if student_user.role != models.UserRole.STUDENT:
                continue
        else:
            password_hash = hash_password("12345678")
            student_user = crud.create_student_with_profile(
                db=db,
                email=student_data["email"],
                password_hash=password_hash,
                first_name=student_data["first_name"],
                last_name=student_data["last_name"],
                middle_name=student_data["middle_name"],
                date_of_birth=student_data["date_of_birth"],
            )

        _, error = crud.add_student_to_group(db, group_id, student_user.id)

        if error in (None, "already_in_group"):
            imported_students.append(student_user)

    return schemas.ImportStudentsResponse(
        group_id=group_id,
        imported_count=len(imported_students),
        imported_students=imported_students,
    )


# =========================
# LESSONS / EDUCATIONAL EVENTS
# =========================

@app.post("/lessons/", response_model=schemas.LessonRead)
def create_lesson(
    lesson: schemas.LessonCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    group = crud.get_group_by_id(db, lesson.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    teacher = crud.get_user_by_id(db, lesson.teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if teacher.role != models.UserRole.TEACHER:
        raise HTTPException(status_code=400, detail="Specified user is not a teacher")

    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Teacher can create lessons only for themselves"
        )

    return crud.create_lesson(db, lesson)


@app.get("/lessons/", response_model=list[schemas.LessonRead])
def read_lessons(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_lessons(db)


@app.get("/students/{student_id}/lessons", response_model=list[schemas.LessonShortRead])
def get_student_lessons(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    return crud.get_lessons_by_student(db, student_id)


# =========================
# CV / VIDEO ANALYSIS
# =========================

@app.post("/cv/analyze-video", response_model=schemas.VideoAnalysisResponse)
def analyze_video(
    lesson_id: int = Form(...),
    student_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    lesson = crud.get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    membership = crud.get_group_membership(db, lesson.group_id, student_id)
    if not membership:
        raise HTTPException(
            status_code=400,
            detail="Student is not assigned to the lesson group"
        )

    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Teacher can analyze video only for their own lessons"
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is missing")

    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are supported")

    active_face_template = crud.get_active_face_template(db, student_id)

    template_path = None
    if active_face_template and active_face_template.image_path:
        db_template_path = Path(active_face_template.image_path)
        if db_template_path.exists():
            template_path = db_template_path

    if template_path is None:
        fallback_template = TEMPLATES_DIR / f"student_{student_id}.jpg"
        if fallback_template.exists():
            template_path = fallback_template

    if template_path is None:
        raise HTTPException(
            status_code=404,
            detail="Face template not found for this student"
        )

    extension = Path(file.filename).suffix or ".mp4"
    safe_filename = f"student_{student_id}_lesson_{lesson_id}_{uuid4().hex}{extension}"
    video_path = UPLOAD_DIR / safe_filename

    try:
        with video_path.open("wb") as buffer:
            buffer.write(file.file.read())

        analysis_result = analyze_video_file(
            video_path=video_path,
            template_path=template_path,
            lesson_id=lesson_id,
            student_id=student_id,
        )

        attendance = crud.create_or_update_attendance(
            db,
            schemas.AttendanceCreate(**analysis_result["attendance_payload"])
        )

        engagement_metric = crud.create_or_update_engagement_metric(
            db,
            schemas.EngagementMetricCreate(**analysis_result["engagement_payload"])
        )

        return schemas.VideoAnalysisResponse(
            attendance=attendance,
            engagement_metric=engagement_metric,
            meta=analysis_result["meta"],
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {str(e)}")


# =========================
# ATTENDANCE
# =========================

@app.post("/attendance/", response_model=schemas.AttendanceRead)
def create_or_update_attendance(
    attendance: schemas.AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    lesson = crud.get_lesson_by_id(db, attendance.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    student = crud.get_user_by_id(db, attendance.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    membership = crud.get_group_membership(db, lesson.group_id, attendance.student_id)
    if not membership:
        raise HTTPException(
            status_code=400,
            detail="Student is not assigned to the lesson group"
        )

    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Teacher can mark attendance only for their own lessons"
        )

    return crud.create_or_update_attendance(db, attendance)


@app.get("/lessons/{lesson_id}/attendance", response_model=list[schemas.AttendanceRead])
def get_lesson_attendance(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    lesson = crud.get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return crud.get_attendance_by_lesson(db, lesson_id)


@app.get("/students/{student_id}/attendance", response_model=list[schemas.AttendanceRead])
def get_student_attendance(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    return crud.get_attendance_by_student(db, student_id)


# =========================
# ENGAGEMENT METRICS
# =========================

@app.post("/engagement-metrics/", response_model=schemas.EngagementMetricRead)
def create_or_update_engagement_metric(
    metric: schemas.EngagementMetricCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    lesson = crud.get_lesson_by_id(db, metric.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    student = crud.get_user_by_id(db, metric.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    membership = crud.get_group_membership(db, lesson.group_id, metric.student_id)
    if not membership:
        raise HTTPException(
            status_code=400,
            detail="Student is not assigned to the lesson group"
        )

    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Teacher can save engagement metrics only for their own lessons"
        )

    return crud.create_or_update_engagement_metric(db, metric)


@app.get(
    "/lessons/{lesson_id}/engagement-metrics",
    response_model=list[schemas.EngagementMetricRead]
)
def get_lesson_engagement_metrics(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    lesson = crud.get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return crud.get_engagement_metrics_by_lesson(db, lesson_id)


@app.get(
    "/students/{student_id}/engagement-metrics",
    response_model=list[schemas.EngagementMetricRead]
)
def get_student_engagement_metrics(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    return crud.get_engagement_metrics_by_student(db, student_id)


# =========================
# ANALYTICS SUMMARY
# =========================

@app.get(
    "/students/{student_id}/analytics-summary",
    response_model=schemas.StudentAnalyticsSummary,
)
def get_student_analytics_summary(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    return crud.build_student_analytics_summary(db, student_id)


@app.get(
    "/groups/{group_id}/analytics-summary",
    response_model=schemas.GroupAnalyticsSummary,
)
def get_group_analytics_summary(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return crud.build_group_analytics_summary(db, group_id)


# =========================
# RECOMMENDATIONS
# =========================

@app.get(
    "/students/{student_id}/recommendations",
    response_model=list[schemas.RecommendationRead],
)
def get_student_recommendations(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    return crud.get_recommendations_by_student(db, student_id)


@app.post(
    "/students/{student_id}/generate-recommendations",
    response_model=schemas.StudentRecommendationsGenerationResponse,
)
def generate_student_recommendations(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    return crud.generate_recommendations_for_student(db, student_id)


@app.post(
    "/groups/{group_id}/generate-recommendations",
    response_model=schemas.GroupRecommendationsGenerationResponse,
)
def generate_group_recommendations(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return crud.generate_recommendations_for_group(db, group_id)


@app.patch(
    "/recommendations/{recommendation_id}/read",
    response_model=schemas.RecommendationRead,
)
def mark_recommendation_as_read(
    recommendation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    recommendation = crud.mark_recommendation_as_read(db, recommendation_id)
    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return recommendation


# =========================
# ASSESSMENT RESULTS
# =========================

@app.post("/assessment-results/", response_model=schemas.AssessmentResultRead)
def create_or_update_assessment_result(
    result: schemas.AssessmentResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    lesson = crud.get_lesson_by_id(db, result.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    student = crud.get_user_by_id(db, result.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="Specified user is not a student")

    membership = crud.get_group_membership(db, lesson.group_id, result.student_id)
    if not membership:
        raise HTTPException(
            status_code=400,
            detail="Student is not assigned to the lesson group"
        )

    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Teacher can grade only their own lessons"
        )

    return crud.create_or_update_assessment_result(db, result)


@app.get("/lessons/{lesson_id}/results", response_model=list[schemas.AssessmentResultRead])
def get_lesson_results(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    lesson = crud.get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return crud.get_results_by_lesson(db, lesson_id)


@app.get("/students/{student_id}/results", response_model=list[schemas.AssessmentResultRead])
def get_student_results(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return crud.get_results_by_student(db, student_id)