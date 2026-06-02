import statistics
import time
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np

from cv_module.config import FACE_MATCH_THRESHOLD, MAX_FRAME_WIDTH, MODEL_NAME, MODEL_VERSION
from cv_module.face_engine import FaceEngine
from cv_module.head_pose import HeadPoseAnalyzer
from cv_module.motion import MotionAnalyzer
from cv_module.service import resize_frame_if_needed


def decode_frame(frame_bytes: bytes) -> Optional[np.ndarray]:
    if not frame_bytes:
        return None
    arr = np.frombuffer(frame_bytes, np.uint8)
    if arr.size == 0:
        return None
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return frame if frame is not None and frame.size > 0 else None


@dataclass
class RealtimeSession:
    session_id: str
    lesson_id: int
    student_id: int
    teacher_id: int
    template_embedding: object
    created_at: float = field(default_factory=time.time)

    motion_analyzer: MotionAnalyzer = field(default_factory=MotionAnalyzer)

    frames_processed: int = 0
    detected_count: int = 0
    matched_count: int = 0
    similarities: list = field(default_factory=list)

    forward_count: int = 0
    pose_detected_count: int = 0
    nose_offsets: list = field(default_factory=list)

    motion_scores: list = field(default_factory=list)

    disappearance_count: int = 0
    _prev_face_detected: bool = field(default=False, repr=False)

    def process_frame(
        self,
        frame_bgr: np.ndarray,
        face_engine: FaceEngine,
        pose_analyzer: HeadPoseAnalyzer,
    ) -> dict:
        self.frames_processed += 1

        resized, _ = resize_frame_if_needed(frame_bgr, MAX_FRAME_WIDTH)
        face = face_engine.get_primary_face(resized)
        face_detected = face is not None

        similarity = None
        is_forward = False

        if face is not None:
            self.detected_count += 1
            similarity = float(face_engine.cosine_similarity(self.template_embedding, face.embedding))
            self.similarities.append(similarity)
            if similarity >= FACE_MATCH_THRESHOLD:
                self.matched_count += 1

            pose = pose_analyzer.analyze_from_kps(face.kps)
            if pose:
                self.pose_detected_count += 1
                self.nose_offsets.append(pose.nose_offset)
                if pose.is_forward:
                    self.forward_count += 1
                    is_forward = True

        if self._prev_face_detected and not face_detected:
            self.disappearance_count += 1
        self._prev_face_detected = face_detected

        face_bbox = face.bbox if face is not None else None
        motion = self.motion_analyzer.analyze(frame_bgr, face_bbox)
        self.motion_scores.append(float(motion.motion_score))

        return {
            "frame": self.frames_processed,
            "face_detected": face_detected,
            "similarity": round(similarity, 3) if similarity is not None else None,
            "is_forward": is_forward,
            "motion_score": round(float(motion.motion_score), 3),
            "total_frames": self.frames_processed,
            "detected_frames": self.detected_count,
            "matched_frames": self.matched_count,
        }

    def aggregate(self, grade_score: float | None = None) -> dict:
        n = self.frames_processed

        presence_ratio = self.detected_count / n if n else 0.0

        face_match_confidence = (
            statistics.mean(self.similarities) if self.similarities else None
        )

        forward_ratio = (
            self.forward_count / self.pose_detected_count if self.pose_detected_count else 0.0
        )

        nose_var = 0.0
        if len(self.nose_offsets) >= 2:
            nose_var = statistics.variance(self.nose_offsets)

        motion_level = (
            statistics.mean(self.motion_scores) if self.motion_scores else 0.0
        )

        n_max = max(n // 10, 1)
        frame_stability = 1.0 - min(self.disappearance_count / n_max, 1.0)

        confidence_for_attendance = face_match_confidence

        return {
            "engagement_payload": {
                "lesson_id": self.lesson_id,
                "student_id": self.student_id,
                "presence_ratio": round(presence_ratio, 4),
                "face_match_confidence": round(face_match_confidence, 4) if face_match_confidence is not None else None,
                "head_pose_forward_ratio": round(forward_ratio, 4),
                "head_pose_variance": round(nose_var, 4),
                "motion_level": round(motion_level, 4),
                "frame_stability": round(frame_stability, 4),
                "grade_score": round(grade_score, 4) if grade_score is not None else None,
                "frame_count": n,
                "model_name": MODEL_NAME,
                "model_version": MODEL_VERSION,
            },
            "attendance_payload": {
                "lesson_id": self.lesson_id,
                "student_id": self.student_id,
                "status": "present" if (
                    presence_ratio >= 0.7
                    and (confidence_for_attendance or 0.0) >= FACE_MATCH_THRESHOLD
                ) else "absent",
                "detected_by_cv": True,
                "confidence": round(confidence_for_attendance, 4) if confidence_for_attendance is not None else None,
            },
            "meta": {
                "processed_frames": n,
                "detected_faces": self.detected_count,
                "matched_faces": self.matched_count,
                "pose_detected_frames": self.pose_detected_count,
                "disappearances": self.disappearance_count,
                "realtime": True,
            },
        }
