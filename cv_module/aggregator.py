from dataclasses import dataclass, asdict


@dataclass
class EngagementPayload:
    lesson_id: int
    student_id: int

    presence_ratio: float
    face_match_confidence: float | None
    head_pose_forward_ratio: float
    head_pose_variance: float
    motion_level: float
    frame_stability: float

    grade_score: float | None = None

    frame_count: int | None = None
    model_name: str | None = None
    model_version: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)