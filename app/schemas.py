from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models import UserRole


# =========================
# USERS
# =========================

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================
# STUDENT PROFILE
# =========================

class StudentProfileBase(BaseModel):
    student_identifier: str
    date_of_birth: Optional[date] = None
    interests: Optional[str] = None
    notes: Optional[str] = None


class StudentProfileCreate(StudentProfileBase):
    pass


class StudentProfileRead(StudentProfileBase):
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================
# GROUPS
# =========================

class GroupBase(BaseModel):
    name: str
    curator_id: Optional[int] = None


class GroupCreate(GroupBase):
    pass


class GroupRead(GroupBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================
# LESSONS
# =========================

class LessonBase(BaseModel):
    group_id: int
    teacher_id: int
    title: str
    lesson_date: date
    starts_at: datetime
    ends_at: datetime
    location: Optional[str] = None
    description: Optional[str] = None


class LessonCreate(LessonBase):
    pass


class LessonRead(LessonBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================
# AUTH
# =========================

class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    role: UserRole

# =========================
# GROUP MEMBERSHIPS
# =========================

class GroupMembershipRead(BaseModel):
    group_id: int
    student_id: int
    joined_at: datetime
    left_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class StudentShortRead(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    role: UserRole

    model_config = ConfigDict(from_attributes=True)


class GroupShortRead(BaseModel):
    id: int
    name: str
    curator_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class ImportedStudentRead(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    role: UserRole

    model_config = ConfigDict(from_attributes=True)


class ImportStudentsResponse(BaseModel):
    group_id: int
    imported_count: int
    imported_students: list[ImportedStudentRead]