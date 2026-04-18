from pathlib import Path
import json

from cv_module.service import analyze_video_file
from cv_module.config import DEFAULT_VIDEO_PATH, DEFAULT_TEMPLATE_PATH, DEFAULT_LESSON_ID, DEFAULT_STUDENT_ID


def main():
    result = analyze_video_file(
        video_path=Path(DEFAULT_VIDEO_PATH),
        template_path=Path(DEFAULT_TEMPLATE_PATH),
        lesson_id=DEFAULT_LESSON_ID,
        student_id=DEFAULT_STUDENT_ID,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()