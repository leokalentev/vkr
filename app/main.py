from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app import crud, models, schemas


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Student Engagement System API")


@app.get("/")
def root():
    return {"message": "API is running"}


@app.post("/users/", response_model=schemas.UserRead)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = crud.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Пока без настоящего хеширования, временно
    fake_password_hash = f"hashed_{user.password}"

    return crud.create_user(db, user, fake_password_hash)


@app.get("/users/", response_model=list[schemas.UserRead])
def read_users(db: Session = Depends(get_db)):
    return crud.get_users(db)


@app.post("/groups/", response_model=schemas.GroupRead)
def create_group(group: schemas.GroupCreate, db: Session = Depends(get_db)):
    return crud.create_group(db, group)


@app.get("/groups/", response_model=list[schemas.GroupRead])
def read_groups(db: Session = Depends(get_db)):
    return crud.get_groups(db)


@app.post("/lessons/", response_model=schemas.LessonRead)
def create_lesson(lesson: schemas.LessonCreate, db: Session = Depends(get_db)):
    return crud.create_lesson(db, lesson)


@app.get("/lessons/", response_model=list[schemas.LessonRead])
def read_lessons(db: Session = Depends(get_db)):
    return crud.get_lessons(db)