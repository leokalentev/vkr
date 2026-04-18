from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from cv_module.config import (
    INSIGHTFACE_MODEL_NAME,
    INSIGHTFACE_PROVIDERS,
    FACE_DET_THRESHOLD,
    INSIGHTFACE_DET_SIZE,
)


@dataclass
class DetectedFace:
    bbox: list[float]
    det_score: float
    embedding: np.ndarray
    kps: Any | None = None


class FaceEngine:
    _app_instance = None

    def __init__(self):
        if FaceEngine._app_instance is None:
            app = FaceAnalysis(
                name=INSIGHTFACE_MODEL_NAME,
                providers=INSIGHTFACE_PROVIDERS,
            )
            app.prepare(ctx_id=0, det_size=INSIGHTFACE_DET_SIZE)
            FaceEngine._app_instance = app

        self.app = FaceEngine._app_instance

    def detect_faces(self, frame_bgr) -> list[DetectedFace]:
        faces = self.app.get(frame_bgr)

        result: list[DetectedFace] = []
        for face in faces:
            det_score = float(getattr(face, "det_score", 0.0))
            if det_score < FACE_DET_THRESHOLD:
                continue

            bbox = face.bbox.tolist() if hasattr(face.bbox, "tolist") else list(face.bbox)
            embedding = np.array(face.embedding, dtype=np.float32)
            kps = getattr(face, "kps", None)

            result.append(
                DetectedFace(
                    bbox=bbox,
                    det_score=det_score,
                    embedding=embedding,
                    kps=kps,
                )
            )

        return result

    def get_primary_face(self, frame_bgr) -> DetectedFace | None:
        faces = self.detect_faces(frame_bgr)
        if not faces:
            return None

        faces.sort(key=lambda x: x.det_score, reverse=True)
        return faces[0]

    def load_template_embedding(self, image_path: str | Path) -> np.ndarray:
        image_path = str(image_path)
        image = cv2.imread(image_path)

        if image is None:
            raise ValueError(f"Не удалось прочитать шаблон: {image_path}")

        h, w = image.shape[:2]
        if w > 1000:
            scale = 1000 / w
            image = cv2.resize(image, (int(w * scale), int(h * scale)))

        face = self.get_primary_face(image)
        if face is None:
            raise ValueError(f"На шаблоне не найдено лицо: {image_path}")

        return face.embedding

    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        emb1 = np.asarray(emb1, dtype=np.float32)
        emb2 = np.asarray(emb2, dtype=np.float32)

        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(np.dot(emb1, emb2) / (norm1 * norm2))