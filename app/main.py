from fastapi import Depends, FastAPI, HTTPException, UploadFile, File
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


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Student Engagement System API",
    description="Backend for student activity and engagement analysis system",
    version="1.0.0",
)

app.include_router(auth_router)


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
    return crud.create_group(db, group)


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