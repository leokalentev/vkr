from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4
import secrets
import string
import threading

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
from app.import_utils import read_students_excel, read_academic_snapshots_excel
from app.email_utils import send_student_credentials_email, send_student_report_email
from app.fuzzy_recommendations import get_hobby_recommendations, ALL_TRAITS
from cv_module.service import analyze_video_file
from cv_module.config import TEMPLATES_DIR
from cv_module.face_engine import FaceEngine
from cv_module.head_pose import HeadPoseAnalyzer
from cv_module.realtime import RealtimeSession, decode_frame


# =========================
# GLOBAL ML ENGINES (инициализируются один раз при старте)
# =========================

_face_engine: FaceEngine | None = None
_pose_analyzer: HeadPoseAnalyzer | None = None
_engine_lock = threading.Lock()

def get_engines() -> tuple[FaceEngine, HeadPoseAnalyzer]:
    global _face_engine, _pose_analyzer
    if _face_engine is None:
        with _engine_lock:
            if _face_engine is None:
                _face_engine = FaceEngine()
                _pose_analyzer = HeadPoseAnalyzer()
    return _face_engine, _pose_analyzer  # type: ignore


# =========================
# REALTIME SESSIONS
# =========================

_active_sessions: dict[str, RealtimeSession] = {}
_sessions_lock = threading.Lock()


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Student Engagement System API",
    description="Backend for student activity and engagement analysis system",
    version="1.0.0",
)


@app.on_event("startup")
def _preload_engines():
    """Прогрев FaceEngine при старте — чтобы первый /cv/start-session не висел 20 секунд."""
    try:
        get_engines()
        print("✅ FaceEngine + HeadPoseAnalyzer ready")
    except Exception as exc:
        print(f"⚠️  FaceEngine preload failed: {exc}")

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


def generate_student_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


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

    plain_password = user.password if user.password else generate_student_password()
    password_hash = hash_password(plain_password)
    db_user = crud.create_user(db, user, password_hash)

    try:
        send_student_credentials_email(
            to_email=user.email,
            full_name=f"{user.last_name} {user.first_name}",
            login=user.email,
            password=plain_password,
        )
    except Exception:
        pass

    return db_user


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


@app.patch("/groups/{group_id}", response_model=schemas.GroupRead)
def update_group(
    group_id: int,
    data: schemas.GroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    group = crud.update_group(db, group_id, data)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@app.delete("/groups/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    if not crud.delete_group(db, group_id):
        raise HTTPException(status_code=404, detail="Group not found")


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

        if error and error.startswith("already_in_other_group"):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Студент {student_data['email']} уже состоит в другой группе. "
                    "Один email не может быть зарегистрирован в нескольких группах."
                ),
            )

        if error in (None, "already_in_group"):
            imported_students.append(student_user)

    return schemas.ImportStudentsResponse(
        group_id=group_id,
        imported_count=len(imported_students),
        imported_students=imported_students,
    )


# =========================
# IMPORT ACADEMIC SNAPSHOTS FROM EXCEL
# =========================

@app.post(
    "/import/academic-snapshots",
    response_model=schemas.AcademicSnapshotImportResponse,
)
def import_academic_snapshots(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is missing")

    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")

    try:
        file_bytes = file.file.read()
        rows = read_academic_snapshots_excel(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")

    processed_items = []
    created_students_count = 0
    created_groups_count = 0

    for row in rows:
        student = crud.get_user_by_email(db, row["email"])
        created_now = False
        plain_password = None

        if not student:
            plain_password = generate_student_password()
            password_hash = hash_password(plain_password)

            student = crud.create_student_with_profile(
                db=db,
                email=row["email"],
                password_hash=password_hash,
                first_name=row["first_name"],
                last_name=row["last_name"],
                middle_name=row["middle_name"],
                date_of_birth=row["date_of_birth"],
            )
            created_students_count += 1
            created_now = True
        else:
            if student.role != models.UserRole.STUDENT:
                raise HTTPException(
                    status_code=400,
                    detail=f"User with email {row['email']} already exists and is not a student"
                )

        group = crud.get_group_by_name(db, row["group_name"])
        if not group:
            curator_id = current_user.id if current_user.role == models.UserRole.TEACHER else None
            group = crud.create_group(
                db,
                schemas.GroupCreate(
                    name=row["group_name"],
                    curator_id=curator_id,
                )
            )
            created_groups_count += 1

        _, membership_error = crud.add_student_to_group(db, group.id, student.id)
        if membership_error not in (None, "already_in_group"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to assign student {row['email']} to group {row['group_name']}: {membership_error}"
            )

        snapshot = crud.create_student_academic_snapshot(
            db,
            schemas.StudentAcademicSnapshotCreate(
                student_id=student.id,
                group_id=group.id,
                subject_name=row["subject_name"],
                total_classes=row["total_classes"],
                attended_classes=row["attended_classes"],
                excused_missed_classes=row["excused_missed_classes"],
                average_score=row["average_score"],
            )
        )

        if created_now and plain_password:
            full_name = f"{student.last_name} {student.first_name}"
            if student.middle_name:
                full_name += f" {student.middle_name}"

            try:
                send_student_credentials_email(
                    to_email=student.email,
                    full_name=full_name,
                    login=student.email,
                    password=plain_password,
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Student {student.email} was created, but email sending failed: {str(e)}"
                )

        processed_items.append(
            schemas.AcademicSnapshotImportItem(
                student_id=student.id,
                email=student.email,
                full_name=f"{student.last_name} {student.first_name}" + (
                    f" {student.middle_name}" if student.middle_name else ""
                ),
                group_name=group.name,
                subject_name=snapshot.subject_name,
                total_classes=snapshot.total_classes,
                attended_classes=snapshot.attended_classes,
                excused_missed_classes=snapshot.excused_missed_classes,
                average_score=float(snapshot.average_score),
            )
        )

    return schemas.AcademicSnapshotImportResponse(
        imported_count=len(processed_items),
        created_students_count=created_students_count,
        created_groups_count=created_groups_count,
        processed_items=processed_items,
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


@app.get("/groups/{group_id}/lessons", response_model=list[schemas.LessonShortRead])
def get_group_lessons(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return crud.get_lessons_by_group(db, group_id)


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


@app.put("/lessons/{lesson_id}", response_model=schemas.LessonShortRead)
def update_lesson(
    lesson_id: int,
    data: schemas.LessonUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    lesson = crud.get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Teacher can edit only their own lessons")
    updated = crud.update_lesson(db, lesson_id, data)
    return updated


@app.delete("/lessons/{lesson_id}", status_code=204)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    lesson = crud.get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Teacher can delete only their own lessons")
    crud.delete_lesson(db, lesson_id)


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

    allowed_video_types = ("video/", "application/octet-stream")
    if file.content_type and not any(file.content_type.startswith(t) for t in allowed_video_types):
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
# FACE TEMPLATE UPLOAD
# =========================

@app.get("/students/{student_id}/face-template/status")
def get_face_template_status(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    """Проверить, есть ли шаблон лица для студента."""
    template = crud.get_active_face_template(db, student_id)
    fallback = TEMPLATES_DIR / f"student_{student_id}.jpg"

    has_file = bool(
        (template and template.image_path and Path(template.image_path).exists())
        or fallback.exists()
    )
    return {
        "has_template": has_file,
        "uploaded_at": template.created_at.isoformat() if template else None,
    }


@app.post("/students/{student_id}/face-template")
def upload_face_template(
    student_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    """Загрузить / обновить эталонное фото лица студента."""
    import cv2
    import numpy as np

    student = crud.get_user_by_id(db, student_id)
    if not student or student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=404, detail="Student not found")

    img_bytes = photo.file.read()
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Не удалось прочитать изображение")

    h, w = frame.shape[:2]
    if w > 1000:
        scale = 1000 / w
        frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

    face_engine, _ = get_engines()
    face = face_engine.get_primary_face(frame)
    if face is None:
        raise HTTPException(status_code=400, detail="На фото не обнаружено лицо. Загрузите чёткое фото с лицом анфас.")

    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    save_path = TEMPLATES_DIR / f"student_{student_id}.jpg"
    cv2.imwrite(str(save_path), frame)

    emb_bytes = face.embedding.tobytes()
    crud.create_face_template(
        db,
        student_id=student_id,
        image_path=str(save_path),
        embedding=emb_bytes,
        embedding_dim=len(face.embedding),
        model_name="insightface+buffalo_l",
        model_version="v1",
    )

    return {"status": "ok", "path": str(save_path)}


# =========================
# REALTIME CV — покадровый анализ с камеры
# =========================

def _resolve_template(db: Session, student_id: int) -> Path:
    """Найти шаблон лица студента или выбросить 404."""
    active = crud.get_active_face_template(db, student_id)
    if active and active.image_path:
        p = Path(active.image_path)
        if p.exists():
            return p
    fallback = TEMPLATES_DIR / f"student_{student_id}.jpg"
    if fallback.exists():
        return fallback
    raise HTTPException(status_code=404, detail="Face template not found for this student")


@app.post("/cv/start-session")
def start_realtime_session(
    lesson_id: int = Form(...),
    student_id: int = Form(...),
    session_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    lesson = crud.get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    student = crud.get_user_by_id(db, student_id)
    if not student or student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=404, detail="Student not found")

    if not crud.get_group_membership(db, lesson.group_id, student_id):
        raise HTTPException(status_code=400, detail="Student is not assigned to the lesson group")

    if current_user.role == models.UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    template_path = _resolve_template(db, student_id)

    face_engine, _ = get_engines()
    try:
        template_embedding = face_engine.load_template_embedding(template_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Ошибка шаблона лица: {e}")

    session = RealtimeSession(
        session_id=session_id,
        lesson_id=lesson_id,
        student_id=student_id,
        teacher_id=current_user.id,
        template_embedding=template_embedding,
    )
    with _sessions_lock:
        # если предыдущая сессия того же студента/мероприятия висит — убираем
        stale = [k for k, s in _active_sessions.items()
                 if s.lesson_id == lesson_id and s.student_id == student_id]
        for k in stale:
            del _active_sessions[k]
        _active_sessions[session_id] = session

    return {"status": "started", "session_id": session_id}


@app.post("/cv/analyze-frame")
def analyze_realtime_frame(
    session_id: str = Form(...),
    frame: UploadFile = File(...),
):
    with _sessions_lock:
        session = _active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    frame_bytes = frame.file.read()
    frame_bgr = decode_frame(frame_bytes)
    if frame_bgr is None:
        raise HTTPException(status_code=400, detail="Cannot decode frame")

    face_engine, pose_analyzer = get_engines()
    result = session.process_frame(frame_bgr, face_engine, pose_analyzer)
    return result


@app.post("/cv/finalize-session", response_model=schemas.VideoAnalysisResponse)
def finalize_realtime_session(
    session_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    with _sessions_lock:
        session = _active_sessions.pop(session_id, None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already finalized")

    if session.frames_processed == 0:
        raise HTTPException(status_code=400, detail="No frames were processed in this session")

    try:
        grade_score = crud.derive_grade_score_from_assessment(
            db, session.lesson_id, session.student_id
        )

        result = session.aggregate(grade_score=grade_score)

        attendance = crud.create_or_update_attendance(
            db, schemas.AttendanceCreate(**result["attendance_payload"])
        )
        engagement_metric = crud.create_or_update_engagement_metric(
            db, schemas.EngagementMetricCreate(**result["engagement_payload"])
        )

        return schemas.VideoAnalysisResponse(
            attendance=attendance,
            engagement_metric=engagement_metric,
            meta=schemas.VideoAnalysisMeta(**result["meta"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Finalize failed: {e}")


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


@app.get("/students/{student_id}/academic-snapshots", response_model=list[schemas.StudentAcademicSnapshotRead])
def get_student_academic_snapshots(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return crud.get_snapshots_by_student(db, student_id)


@app.post("/students/{student_id}/send-report", status_code=200)
def send_student_report(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    student = crud.get_user_by_id(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    attendance_records = crud.get_attendance_by_student(db, student_id)
    attended = sum(1 for a in attendance_records if a.status.lower() in ("present", "late"))
    total_att = len(attendance_records)
    att_pct = (attended / total_att * 100) if total_att > 0 else None

    snapshots = crud.get_snapshots_by_student(db, student_id)
    journal_score: float | None = None
    if snapshots:
        journal_score = sum(s.average_score for s in snapshots) / len(snapshots)

    results = crud.get_results_by_student(db, student_id)
    exam_score: float | None = None
    if results:
        exam_score = sum(r.score for r in results if r.score is not None) / len(results)

    total_score: float | None = None
    if journal_score is not None and exam_score is not None:
        total_score = journal_score + exam_score
    elif journal_score is not None:
        total_score = journal_score

    teacher_name = f"{current_user.last_name} {current_user.first_name}"

    try:
        send_student_report_email(
            to_email=student.email,
            full_name=f"{student.last_name} {student.first_name}",
            attendance_attended=attended,
            attendance_total=total_att,
            attendance_pct=att_pct,
            journal_score=journal_score,
            exam_score=exam_score,
            total_score=total_score,
            teacher_name=teacher_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Не удалось отправить письмо: {e}")

    return {"detail": "Отчёт успешно отправлен на почту студента"}


@app.post("/students/{student_id}/hobby-recommendations")
def hobby_recommendations(
    student_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    traits: list[str] = body.get("traits", [])
    if len(traits) < 1:
        raise HTTPException(status_code=400, detail="Укажите хотя бы одну черту характера")
    if len(traits) > 10:
        raise HTTPException(status_code=400, detail="Можно выбрать не более 10 черт")

    recs = get_hobby_recommendations(traits)
    return {"recommendations": recs, "all_traits": ALL_TRAITS}


@app.post(
    "/groups/{group_id}/import-academic-snapshots",
    response_model=schemas.AcademicSnapshotImportResponse,
)
def import_academic_snapshots_to_group(
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
        rows = read_academic_snapshots_excel(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")

    processed_items = []
    created_students_count = 0
    created_groups_count = 0

    for row in rows:
        # Проверяем, что группа в Excel совпадает с текущей страницей группы
        if row["group_name"].strip() != group.name:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"В Excel указана группа '{row['group_name']}', "
                    f"но импорт выполняется для группы '{group.name}'"
                ),
            )

        student = crud.get_user_by_email(db, row["email"])
        created_now = False
        plain_password = None

        if not student:
            plain_password = generate_student_password()
            password_hash = hash_password(plain_password)

            student = crud.create_student_with_profile(
                db=db,
                email=row["email"],
                password_hash=password_hash,
                first_name=row["first_name"],
                last_name=row["last_name"],
                middle_name=row["middle_name"],
                date_of_birth=row["date_of_birth"],
            )
            created_students_count += 1
            created_now = True
        else:
            if student.role != models.UserRole.STUDENT:
                raise HTTPException(
                    status_code=400,
                    detail=f"User with email {row['email']} already exists and is not a student"
                )

        _, membership_error = crud.add_student_to_group(db, group.id, student.id)
        if membership_error and membership_error.startswith("already_in_other_group"):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Студент {row['email']} уже состоит в другой группе. "
                    "Один email не может быть зарегистрирован в нескольких группах."
                ),
            )
        if membership_error not in (None, "already_in_group"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to assign student {row['email']} to group {group.name}: {membership_error}"
            )

        snapshot = crud.create_student_academic_snapshot(
            db,
            schemas.StudentAcademicSnapshotCreate(
                student_id=student.id,
                group_id=group.id,
                subject_name=row["subject_name"],
                total_classes=row["total_classes"],
                attended_classes=row["attended_classes"],
                excused_missed_classes=row["excused_missed_classes"],
                average_score=row["average_score"],
            )
        )

        # Auto-create lesson when event_type (Зачёт/Экзамен) is specified in Excel
        event_type = row.get("event_type")
        event_name = row.get("event_name") or row["subject_name"]
        if event_type in ("Зачёт", "Экзамен"):
            crud.find_or_create_lesson_from_import(
                db=db,
                group_id=group.id,
                teacher_id=current_user.id,
                event_name=event_name,
                event_type=event_type,
            )

        if created_now and plain_password:
            full_name = f"{student.last_name} {student.first_name}"
            if student.middle_name:
                full_name += f" {student.middle_name}"

            try:
                send_student_credentials_email(
                    to_email=student.email,
                    full_name=full_name,
                    login=student.email,
                    password=plain_password,
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Student {student.email} was created, but email sending failed: {str(e)}"
                )

        processed_items.append(
            schemas.AcademicSnapshotImportItem(
                student_id=student.id,
                email=student.email,
                full_name=f"{student.last_name} {student.first_name}" + (
                    f" {student.middle_name}" if student.middle_name else ""
                ),
                group_name=group.name,
                subject_name=snapshot.subject_name,
                total_classes=snapshot.total_classes,
                attended_classes=snapshot.attended_classes,
                excused_missed_classes=snapshot.excused_missed_classes,
                average_score=float(snapshot.average_score),
            )
        )

    return schemas.AcademicSnapshotImportResponse(
        imported_count=len(processed_items),
        created_students_count=created_students_count,
        created_groups_count=created_groups_count,
        processed_items=processed_items,
    )