from pathlib import Path

from config import (
    DEFAULT_VIDEO_PATH,
    DEFAULT_TEMPLATE_PATH,
    FRAME_STRIDE,
    MAX_FRAMES,
    FACE_MATCH_THRESHOLD,
)
from video_processor import VideoProcessor
from face_engine import FaceEngine
from head_pose import HeadPoseAnalyzer


def main():
    video_path = Path(DEFAULT_VIDEO_PATH)
    template_path = Path(DEFAULT_TEMPLATE_PATH)

    if not video_path.exists():
        print(f"[ERROR] Видео не найдено: {video_path}")
        return

    if not template_path.exists():
        print(f"[ERROR] Шаблон не найден: {template_path}")
        print("Положи фото студента в cv_module/templates/student_1.jpg")
        return

    processor = VideoProcessor(video_path)
    meta = processor.get_meta()

    print("=== VIDEO META ===")
    print(f"path: {meta.path}")
    print(f"fps: {meta.fps:.2f}")
    print(f"frame_count: {meta.frame_count}")
    print(f"width x height: {meta.width} x {meta.height}")
    print(f"duration_sec: {meta.duration_sec:.2f}")
    print()

    print("=== INIT ENGINES ===")
    face_engine = FaceEngine()
    pose_analyzer = HeadPoseAnalyzer()
    print("[OK] InsightFace и MediaPipe инициализированы")
    print()

    print("=== LOAD TEMPLATE ===")
    template_embedding = face_engine.load_template_embedding(template_path)
    print(f"[OK] Шаблон загружен: {template_path}")
    print(f"[OK] embedding_dim={len(template_embedding)}")
    print()

    print("=== FACE MATCHING + HEAD POSE ===")
    processed = 0
    detected_count = 0
    matched_count = 0
    similarities: list[float] = []

    pose_detected_count = 0
    forward_count = 0
    nose_offsets: list[float] = []
    forward_scores: list[float] = []

    for item in processor.iter_frames(
            frame_stride=FRAME_STRIDE,
            max_frames=MAX_FRAMES,
    ):
        primary_face = face_engine.get_primary_face(item.frame)
        processed += 1

        if primary_face is None:
            print(
                f"frame_index={item.frame_index}, "
                f"timestamp={item.timestamp_sec:.2f}s, "
                f"face=NOT_FOUND"
            )
            continue

        detected_count += 1

        similarity = face_engine.cosine_similarity(
            template_embedding,
            primary_face.embedding,
        )
        similarities.append(similarity)

        is_match = similarity >= FACE_MATCH_THRESHOLD
        if is_match:
            matched_count += 1

        pose_result = pose_analyzer.analyze_from_kps(primary_face.kps)

        if pose_result is not None:
            pose_detected_count += 1
            nose_offsets.append(pose_result.nose_offset)
            forward_scores.append(pose_result.forward_score)

            if pose_result.is_forward:
                forward_count += 1

            print(
                f"frame_index={item.frame_index}, "
                f"timestamp={item.timestamp_sec:.2f}s, "
                f"det_score={primary_face.det_score:.4f}, "
                f"similarity={similarity:.4f}, "
                f"match={is_match}, "
                f"forward={pose_result.is_forward}, "
                f"forward_score={pose_result.forward_score:.4f}, "
                f"nose_offset={pose_result.nose_offset:.4f}"
            )
        else:
            print(
                f"frame_index={item.frame_index}, "
                f"timestamp={item.timestamp_sec:.2f}s, "
                f"det_score={primary_face.det_score:.4f}, "
                f"similarity={similarity:.4f}, "
                f"match={is_match}, "
                f"pose=NOT_FOUND"
            )

    print()
    print(f"[OK] Обработано кадров: {processed}")
    print(f"[OK] Лицо найдено в кадрах: {detected_count}")

    if processed > 0:
        presence_ratio = detected_count / processed
        print(f"[OK] presence_ratio={presence_ratio:.4f}")

    if similarities:
        avg_similarity = sum(similarities) / len(similarities)
        max_similarity = max(similarities)
        min_similarity = min(similarities)
        match_ratio = matched_count / len(similarities)

        print(f"[OK] avg_similarity={avg_similarity:.4f}")
        print(f"[OK] max_similarity={max_similarity:.4f}")
        print(f"[OK] min_similarity={min_similarity:.4f}")
        print(f"[OK] matched_frames={matched_count}")
        print(f"[OK] face_match_confidence={match_ratio:.4f}")
    else:
        print("[WARN] similarity не рассчитана: лицо не найдено ни в одном кадре")

    if pose_detected_count > 0:
        head_pose_forward_ratio = forward_count / pose_detected_count
        avg_forward_score = sum(forward_scores) / len(forward_scores)

        nose_offsets_mean = sum(nose_offsets) / len(nose_offsets)
        nose_offsets_var = sum((x - nose_offsets_mean) ** 2 for x in nose_offsets) / len(nose_offsets)

        print(f"[OK] pose_detected_frames={pose_detected_count}")
        print(f"[OK] forward_frames={forward_count}")
        print(f"[OK] head_pose_forward_ratio={head_pose_forward_ratio:.4f}")
        print(f"[OK] avg_forward_score={avg_forward_score:.4f}")
        print(f"[OK] head_pose_variance={nose_offsets_var:.4f}")
    else:
        print("[WARN] head pose не рассчитан")


if __name__ == "__main__":
    main()