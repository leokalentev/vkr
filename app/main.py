from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app import crud, schemas, models
from app.auth import (
    router as auth_router,
    get_current_active_user,
    require_roles,
)
from app.security import hash_password


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
# LESSONS
# =========================

@app.post("/lessons/", response_model=schemas.LessonRead)
def create_lesson(
    lesson: schemas.LessonCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(models.UserRole.TEACHER, models.UserRole.ADMIN)
    ),
):
    return crud.create_lesson(db, lesson)


@app.get("/lessons/", response_model=list[schemas.LessonRead])
def read_lessons(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    return crud.get_lessons(db)