from pathlib import Path
import cv2

from cv_module.config import (
    FRAME_STRIDE,
    MAX_FRAMES,
    FACE_MATCH_THRESHOLD,
    MODEL_NAME,
    MODEL_VERSION,
    MAX_FRAME_WIDTH,
    FACE_DETECTION_EVERY_N_FRAMES,
)
from cv_module.video_processor import VideoProcessor
from cv_module.face_engine import FaceEngine, DetectedFace
from cv_module.head_pose import HeadPoseAnalyzer
from cv_module.motion import MotionAnalyzer
from cv_module.aggregator import EngagementPayload


def determine_attendance_status(
    presence_ratio: float,
    face_match_confidence: float | None,
) -> str:
    confidence = face_match_confidence or 0.0

    if presence_ratio >= 0.7 and confidence >= 0.6:
        return "present"

    return "absent"


def resize_frame_if_needed(frame_bgr, max_width: int):
    h, w = frame_bgr.shape[:2]
    if w <= max_width:
        return frame_bgr, 1.0

    scale = max_width / w
    resized = cv2.resize(frame_bgr, (int(w * scale), int(h * scale)))
    return resized, scale


def scale_bbox_back(bbox: list[float], scale: float) -> list[float]:
    if scale == 1.0:
        return bbox
    return [value / scale for value in bbox]


def analyze_video_file(
    video_path: str | Path,
    template_path: str | Path,
    lesson_id: int,
    student_id: int,
) -> dict:
    video_path = Path(video_path)
    template_path = Path(template_path)

    if not video_path.exists():
        raise ValueError(f"Видео не найдено: {video_path}")

    if not template_path.exists():
        raise ValueError(f"Шаблон лица не найден: {template_path}")

    processor = VideoProcessor(video_path)
    face_engine = FaceEngine()
    pose_analyzer = HeadPoseAnalyzer()
    motion_analyzer = MotionAnalyzer()

    template_embedding = face_engine.load_template_embedding(template_path)

    processed = 0
    detected_count = 0
    matched_count = 0
    similarities = []

    pose_detected_count = 0
    forward_count = 0
    nose_offsets = []

    motion_scores = []
    stability_scores = []

    last_face: DetectedFace | None = None

    for local_index, item in enumerate(
        processor.iter_frames(
            frame_stride=FRAME_STRIDE,
            max_frames=MAX_FRAMES,
        )
    ):
        processed += 1

        resized_frame, scale = resize_frame_if_needed(item.frame, MAX_FRAME_WIDTH)

        should_run_detection = (
            local_index % FACE_DETECTION_EVERY_N_FRAMES == 0 or last_face is None
        )

        primary_face = None
        if should_run_detection:
            detected_on_small = face_engine.get_primary_face(resized_frame)
            if detected_on_small is not None:
                corrected_bbox = scale_bbox_back(detected_on_small.bbox, scale)
                primary_face = DetectedFace(
                    bbox=corrected_bbox,
                    det_score=detected_on_small.det_score,
                    embedding=detected_on_small.embedding,
                    kps=detected_on_small.kps,
                )
                last_face = primary_face
            else:
                last_face = None
        else:
            primary_face = last_face

        face_bbox = primary_face.bbox if primary_face else None
        motion_result = motion_analyzer.analyze(item.frame, face_bbox)
        motion_scores.append(motion_result.motion_score)
        stability_scores.append(motion_result.stability_score)

        if primary_face is None:
            continue

        detected_count += 1

        similarity = face_engine.cosine_similarity(
            template_embedding,
            primary_face.embedding,
        )
        similarities.append(similarity)

        if similarity >= FACE_MATCH_THRESHOLD:
            matched_count += 1

        pose_result = pose_analyzer.analyze_from_kps(primary_face.kps)
        if pose_result:
            pose_detected_count += 1
            nose_offsets.append(pose_result.nose_offset)

            if pose_result.is_forward:
                forward_count += 1

        # ранний выход, если уже достаточно данных для вывода
        if processed >= 25 and len(similarities) >= 15:
            current_presence = detected_count / processed if processed else 0.0
            current_confidence = matched_count / len(similarities) if similarities else 0.0

            if current_presence >= 0.85 and current_confidence >= 0.75:
                break

    presence_ratio = detected_count / processed if processed else 0.0

    face_match_confidence = (
        matched_count / len(similarities) if similarities else None
    )

    head_pose_forward_ratio = (
        forward_count / pose_detected_count if pose_detected_count else 0.0
    )

    head_pose_variance = 0.0
    if nose_offsets:
        mean = sum(nose_offsets) / len(nose_offsets)
        head_pose_variance = sum((x - mean) ** 2 for x in nose_offsets) / len(nose_offsets)

    motion_level = sum(motion_scores) / len(motion_scores) if motion_scores else 0.0
    frame_stability = sum(stability_scores) / len(stability_scores) if stability_scores else 0.0

    engagement_payload = EngagementPayload(
        lesson_id=lesson_id,
        student_id=student_id,
        presence_ratio=round(presence_ratio, 4),
        face_match_confidence=round(face_match_confidence, 4) if face_match_confidence is not None else None,
        head_pose_forward_ratio=round(head_pose_forward_ratio, 4),
        head_pose_variance=round(head_pose_variance, 4),
        motion_level=round(motion_level, 4),
        frame_stability=round(frame_stability, 4),
        grade_score=None,
        frame_count=processed,
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
    )

    attendance_payload = {
        "lesson_id": lesson_id,
        "student_id": student_id,
        "status": determine_attendance_status(
            presence_ratio=presence_ratio,
            face_match_confidence=face_match_confidence,
        ),
        "detected_by_cv": True,
        "confidence": round(face_match_confidence, 4) if face_match_confidence is not None else None,
    }

    return {
        "engagement_payload": engagement_payload.to_dict(),
        "attendance_payload": attendance_payload,
        "meta": {
            "processed_frames": processed,
            "detected_faces": detected_count,
            "matched_faces": matched_count,
            "pose_detected_frames": pose_detected_count,
            "video_path": str(video_path),
            "template_path": str(template_path),
        },
    }