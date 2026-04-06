from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import UserRole, AttendanceStatus, RecommendationType


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


class GroupCreate(GroupBase):
    curator_id: Optional[int] = None


class GroupRead(GroupBase):
    id: int
    curator_id: Optional[int] = None
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


# =========================
# IMPORT
# =========================

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


# =========================
# ATTENDANCE
# =========================

class AttendanceBase(BaseModel):
    lesson_id: int
    student_id: int
    status: AttendanceStatus = AttendanceStatus.PRESENT
    detected_by_cv: bool = False
    confidence: Optional[float] = Field(default=None, ge=0, le=1)


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceRead(AttendanceBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================
# ENGAGEMENT METRICS
# =========================

class EngagementMetricBase(BaseModel):
    lesson_id: int
    student_id: int

    presence_ratio: float = Field(ge=0, le=1)
    face_match_confidence: Optional[float] = Field(default=None, ge=0, le=1)
    head_pose_forward_ratio: float = Field(ge=0, le=1)
    head_pose_variance: float = Field(ge=0, le=1)
    motion_level: float = Field(ge=0, le=1)
    frame_stability: float = Field(ge=0, le=1)
    grade_score: Optional[float] = Field(default=None, ge=0, le=1)

    frame_count: Optional[int] = Field(default=None, ge=0)
    model_name: Optional[str] = None
    model_version: Optional[str] = None


class EngagementMetricCreate(EngagementMetricBase):
    pass


class EngagementMetricRead(EngagementMetricBase):
    id: int
    engagement_index: float
    weights_json: Optional[dict] = None
    computed_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================
# ASSESSMENT RESULTS
# =========================

class AssessmentResultBase(BaseModel):
    lesson_id: int
    student_id: int
    score: Optional[float] = None
    max_score: Optional[float] = None
    grade_label: Optional[str] = None
    attendance_weight: Optional[float] = None
    academic_weight: Optional[float] = None
    engagement_weight: Optional[float] = None
    final_score: Optional[float] = None
    teacher_comment: Optional[str] = None


class AssessmentResultCreate(AssessmentResultBase):
    pass


class AssessmentResultRead(AssessmentResultBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================
# ANALYTICS SUMMARY
# =========================

class StudentAnalyticsSummary(BaseModel):
    student: StudentShortRead
    groups: list[GroupShortRead]

    total_attendance_records: int
    attended_records: int
    attendance_rate_percent: Optional[float] = None
    attendance_score: Optional[float] = None

    total_assessment_results: int
    average_academic_score: Optional[float] = None

    total_engagement_metrics: int
    average_engagement_index: Optional[float] = None

    integral_engagement_score: Optional[float] = None
    engagement_level: str
    component_weights: dict


class GroupStudentAnalyticsItem(BaseModel):
    rank: int
    student: StudentShortRead
    attendance_score: Optional[float] = None
    average_academic_score: Optional[float] = None
    average_engagement_index: Optional[float] = None
    integral_engagement_score: Optional[float] = None
    engagement_level: str


class GroupAnalyticsSummary(BaseModel):
    group: GroupRead
    total_students: int

    average_attendance_score: Optional[float] = None
    average_academic_score: Optional[float] = None
    average_engagement_index: Optional[float] = None
    average_integral_engagement_score: Optional[float] = None

    top_student: Optional[StudentShortRead] = None
    students: list[GroupStudentAnalyticsItem]


# =========================
# RECOMMENDATIONS
# =========================

class RecommendationRead(BaseModel):
    id: int
    student_id: int
    lesson_id: Optional[int] = None
    recommendation_type: RecommendationType
    title: str
    text: str
    confidence_score: Optional[float] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentRecommendationsGenerationResponse(BaseModel):
    student_id: int
    integral_engagement_score: Optional[float] = None
    engagement_level: str
    generated_count: int
    recommendations: list[RecommendationRead]


class GroupRecommendationsGenerationResponse(BaseModel):
    group_id: int
    total_students: int
    total_generated_recommendations: int