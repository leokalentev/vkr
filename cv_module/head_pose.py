from dataclasses import dataclass
import numpy as np


@dataclass
class HeadPoseResult:
    forward_score: float
    is_forward: bool
    nose_offset: float


class HeadPoseAnalyzer:
    """
    MVP-оценка положения головы по 5 keypoints InsightFace:
    left_eye, right_eye, nose, left_mouth, right_mouth
    """

    def __init__(self, forward_threshold: float = 0.10):
        self.forward_threshold = forward_threshold

    def analyze_from_kps(self, kps) -> HeadPoseResult | None:
        if kps is None:
            return None

        pts = np.asarray(kps, dtype=np.float32)
        if pts.shape[0] < 5:
            return None

        left_eye = pts[0]
        right_eye = pts[1]
        nose = pts[2]
        left_mouth = pts[3]
        right_mouth = pts[4]

        eye_center_x = (left_eye[0] + right_eye[0]) / 2.0
        mouth_center_x = (left_mouth[0] + right_mouth[0]) / 2.0
        face_center_x = (eye_center_x + mouth_center_x) / 2.0

        face_width = max(abs(right_eye[0] - left_eye[0]), 1.0)

        nose_offset = abs(nose[0] - face_center_x) / face_width

        forward_score = 1.0 - min(nose_offset / self.forward_threshold, 1.0)
        forward_score = float(max(0.0, min(1.0, forward_score)))

        is_forward = nose_offset <= self.forward_threshold

        return HeadPoseResult(
            forward_score=forward_score,
            is_forward=is_forward,
            nose_offset=float(nose_offset),
        )