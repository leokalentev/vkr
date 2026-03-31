from datetime import datetime, date
from enum import Enum as PyEnum

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# =========================================
# ENUMS
# =========================================

class UserRole(str, PyEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class AttendanceStatus(str, PyEnum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"


class RecommendationType(str, PyEnum):
    ACADEMIC = "academic"
    ACTIVITY = "activity"
    RISK = "risk"
    MOTIVATION = "motivation"


def enum_values(enum_cls):
    return [item.value for item in enum_cls]


# =========================================
# USERS
# =========================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            values_callable=enum_values,
            validate_strings=True,
        ),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    student_profile: Mapped["StudentProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    group_memberships: Mapped[list["GroupMembership"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )

    taught_groups: Mapped[list["Group"]] = relationship(
        back_populates="curator", foreign_keys="Group.curator_id"
    )

    taught_lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="teacher", foreign_keys="Lesson.teacher_id"
    )

    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )

    engagement_metrics: Mapped[list["EngagementMetric"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )

    assessment_results: Mapped[list["AssessmentResult"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )

    face_templates: Mapped[list["FaceTemplate"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )

    recommendations: Mapped[list["Recommendation"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )


# =========================================
# STUDENT PROFILES
# =========================================

class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    student_identifier: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    interests: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="student_profile")


# =========================================
# GROUPS
# =========================================

class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    curator_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    curator: Mapped["User | None"] = relationship(
        back_populates="taught_groups", foreign_keys=[curator_id]
    )

    memberships: Mapped[list["GroupMembership"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )

    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


# =========================================
# GROUP MEMBERSHIPS
# =========================================

class GroupMembership(Base):
    __tablename__ = "group_memberships"

    group_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("left_at IS NULL OR left_at >= joined_at", name="chk_group_membership_dates"),
    )

    group: Mapped["Group"] = relationship(back_populates="memberships")
    student: Mapped["User"] = relationship(back_populates="group_memberships")


# =========================================
# LESSONS
# =========================================

class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    teacher_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    lesson_date: Mapped[date] = mapped_column(Date, nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="chk_lesson_time"),
    )

    group: Mapped["Group"] = relationship(back_populates="lessons")
    teacher: Mapped["User"] = relationship(
        back_populates="taught_lessons", foreign_keys=[teacher_id]
    )

    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )

    engagement_metrics: Mapped[list["EngagementMetric"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )

    assessment_results: Mapped[list["AssessmentResult"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )

    recommendations: Mapped[list["Recommendation"]] = relationship(
        back_populates="lesson"
    )


# =========================================
# ATTENDANCE
# =========================================

class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(
            AttendanceStatus,
            name="attendance_status",
            values_callable=enum_values,
            validate_strings=True,
        ),
        default=AttendanceStatus.PRESENT,
        nullable=False,
    )
    detected_by_cv: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("lesson_id", "student_id", name="uq_attendance_lesson_student"),
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="chk_attendance_confidence",
        ),
    )

    lesson: Mapped["Lesson"] = relationship(back_populates="attendance_records")
    student: Mapped["User"] = relationship(back_populates="attendance_records")


# =========================================
# ENGAGEMENT METRICS
# =========================================

class EngagementMetric(Base):
    __tablename__ = "engagement_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    presence_ratio: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    face_match_confidence: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    head_pose_forward_ratio: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    head_pose_variance: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    motion_level: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    frame_stability: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    grade_score: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)

    engagement_index: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    frame_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weights_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("lesson_id", "student_id", name="uq_engagement_lesson_student"),
        CheckConstraint("presence_ratio >= 0 AND presence_ratio <= 1", name="chk_presence_ratio"),
        CheckConstraint(
            "face_match_confidence IS NULL OR (face_match_confidence >= 0 AND face_match_confidence <= 1)",
            name="chk_face_match_confidence",
        ),
        CheckConstraint(
            "head_pose_forward_ratio >= 0 AND head_pose_forward_ratio <= 1",
            name="chk_head_pose_forward_ratio",
        ),
        CheckConstraint(
            "head_pose_variance >= 0 AND head_pose_variance <= 1",
            name="chk_head_pose_variance",
        ),
        CheckConstraint("motion_level >= 0 AND motion_level <= 1", name="chk_motion_level"),
        CheckConstraint("frame_stability >= 0 AND frame_stability <= 1", name="chk_frame_stability"),
        CheckConstraint(
            "grade_score IS NULL OR (grade_score >= 0 AND grade_score <= 1)",
            name="chk_grade_score",
        ),
        CheckConstraint(
            "engagement_index >= 0 AND engagement_index <= 1",
            name="chk_engagement_index",
        ),
    )

    lesson: Mapped["Lesson"] = relationship(back_populates="engagement_metrics")
    student: Mapped["User"] = relationship(back_populates="engagement_metrics")


# =========================================
# ASSESSMENT RESULTS
# =========================================

class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    max_score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    grade_label: Mapped[str | None] = mapped_column(String(20), nullable=True)

    attendance_weight: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    academic_weight: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    engagement_weight: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)

    final_score: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("lesson_id", "student_id", name="uq_result_lesson_student"),
        CheckConstraint("score IS NULL OR score >= 0", name="chk_score_nonnegative"),
        CheckConstraint("max_score IS NULL OR max_score > 0", name="chk_max_score_positive"),
        CheckConstraint(
            "score IS NULL OR max_score IS NULL OR score <= max_score",
            name="chk_score_lte_max",
        ),
        CheckConstraint(
            "attendance_weight IS NULL OR (attendance_weight >= 0 AND attendance_weight <= 1)",
            name="chk_attendance_weight",
        ),
        CheckConstraint(
            "academic_weight IS NULL OR (academic_weight >= 0 AND academic_weight <= 1)",
            name="chk_academic_weight",
        ),
        CheckConstraint(
            "engagement_weight IS NULL OR (engagement_weight >= 0 AND engagement_weight <= 1)",
            name="chk_engagement_weight",
        ),
        CheckConstraint(
            "final_score IS NULL OR (final_score >= 0 AND final_score <= 1)",
            name="chk_final_score",
        ),
    )

    lesson: Mapped["Lesson"] = relationship(back_populates="assessment_results")
    student: Mapped["User"] = relationship(back_populates="assessment_results")


# =========================================
# FACE TEMPLATES
# =========================================

class FaceTemplate(Base):
    __tablename__ = "face_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    embedding: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    embedding_dim: Mapped[int] = mapped_column(Integer, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint("embedding_dim > 0", name="chk_embedding_dim_positive"),
    )

    student: Mapped["User"] = relationship(back_populates="face_templates")


# =========================================
# RECOMMENDATIONS
# =========================================

class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    lesson_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True
    )
    recommendation_type: Mapped[RecommendationType] = mapped_column(
        Enum(
            RecommendationType,
            name="recommendation_type",
            values_callable=enum_values,
            validate_strings=True,
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)",
            name="chk_recommendation_confidence",
        ),
    )

    student: Mapped["User"] = relationship(back_populates="recommendations")
    lesson: Mapped["Lesson | None"] = relationship(back_populates="recommendations")