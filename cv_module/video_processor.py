from dataclasses import dataclass
from pathlib import Path
from typing import Generator

import cv2


@dataclass
class VideoMeta:
    path: str
    fps: float
    frame_count: int
    width: int
    height: int
    duration_sec: float


@dataclass
class FrameItem:
    frame_index: int
    timestamp_sec: float
    frame: any


class VideoProcessor:
    def __init__(self, video_path: str | Path):
        self.video_path = str(video_path)

    def get_meta(self) -> VideoMeta:
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            raise ValueError(f"Не удалось открыть видео: {self.video_path}")

        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        cap.release()

        duration_sec = 0.0
        if fps > 0:
            duration_sec = frame_count / fps

        return VideoMeta(
            path=self.video_path,
            fps=fps,
            frame_count=frame_count,
            width=width,
            height=height,
            duration_sec=duration_sec,
        )

    def iter_frames(
        self,
        frame_stride: int = 1,
        max_frames: int | None = None,
    ) -> Generator[FrameItem, None, None]:
        if frame_stride < 1:
            raise ValueError("frame_stride должен быть >= 1")

        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            raise ValueError(f"Не удалось открыть видео: {self.video_path}")

        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_index = 0
        yielded = 0

        try:
            while True:
                success, frame = cap.read()
                if not success:
                    break

                if frame_index % frame_stride == 0:
                    timestamp_sec = frame_index / fps if fps > 0 else 0.0
                    yield FrameItem(
                        frame_index=frame_index,
                        timestamp_sec=timestamp_sec,
                        frame=frame,
                    )
                    yielded += 1

                    if max_frames is not None and yielded >= max_frames:
                        break

                frame_index += 1
        finally:
            cap.release()