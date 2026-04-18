from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class MotionResult:
    motion_score: float
    stability_score: float


class MotionAnalyzer:
    def __init__(self):
        self.prev_gray: np.ndarray | None = None
        self.prev_face_center: np.ndarray | None = None

    def analyze(self, frame_bgr, face_bbox: list[float] | None = None) -> MotionResult:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)

        motion_score = 0.0
        stability_score = 1.0

        if self.prev_gray is not None:
            diff = cv2.absdiff(gray, self.prev_gray)
            mean_diff = float(np.mean(diff))

            # 255 -> максимум, переводим в 0..1
            motion_score = min(mean_diff / 255.0, 1.0)

        face_center = None
        if face_bbox is not None and len(face_bbox) == 4:
            x1, y1, x2, y2 = face_bbox
            face_center = np.array(
                [(x1 + x2) / 2.0, (y1 + y2) / 2.0],
                dtype=np.float32,
            )

        if face_center is not None and self.prev_face_center is not None:
            shift = np.linalg.norm(face_center - self.prev_face_center)

            h, w = gray.shape
            diagonal = max((w**2 + h**2) ** 0.5, 1.0)

            normalized_shift = shift / diagonal
            stability_score = 1.0 - min(normalized_shift * 10.0, 1.0)
            stability_score = float(max(0.0, min(1.0, stability_score)))

        self.prev_gray = gray
        if face_center is not None:
            self.prev_face_center = face_center

        return MotionResult(
            motion_score=float(motion_score),
            stability_score=float(stability_score),
        )