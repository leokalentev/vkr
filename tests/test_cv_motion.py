"""Unit tests for cv_module/motion.py — MotionAnalyzer."""
import numpy as np
import pytest

from cv_module.motion import MotionAnalyzer, MotionResult


def _blank_frame(h=480, w=640):
    return np.zeros((h, w, 3), dtype=np.uint8)


def _noisy_frame(h=480, w=640, noise=50):
    return np.random.randint(0, noise, (h, w, 3), dtype=np.uint8)


class TestMotionAnalyzerInit:
    def test_initial_state(self):
        ma = MotionAnalyzer()
        assert ma.prev_gray is None
        assert ma.prev_face_center is None

    def test_first_frame_returns_zero_motion(self):
        ma = MotionAnalyzer()
        result = ma.analyze(_blank_frame())
        assert result.motion_score == 0.0

    def test_first_frame_returns_perfect_stability(self):
        ma = MotionAnalyzer()
        result = ma.analyze(_blank_frame())
        assert result.stability_score == 1.0


class TestMotionScore:
    def test_identical_frames_give_zero_motion(self):
        ma = MotionAnalyzer()
        frame = _blank_frame()
        ma.analyze(frame)
        result = ma.analyze(frame)
        assert result.motion_score == 0.0

    def test_very_different_frames_give_high_motion(self):
        ma = MotionAnalyzer()
        ma.analyze(np.zeros((480, 640, 3), dtype=np.uint8))
        result = ma.analyze(np.full((480, 640, 3), 255, dtype=np.uint8))
        assert result.motion_score > 0.5

    def test_motion_score_bounded_0_1(self):
        ma = MotionAnalyzer()
        for _ in range(5):
            result = ma.analyze(_noisy_frame())
            assert 0.0 <= result.motion_score <= 1.0

    def test_returns_motion_result_dataclass(self):
        ma = MotionAnalyzer()
        result = ma.analyze(_blank_frame())
        assert isinstance(result, MotionResult)


class TestStabilityScore:
    def test_stationary_face_gives_high_stability(self):
        ma = MotionAnalyzer()
        bbox = [100.0, 100.0, 200.0, 200.0]
        ma.analyze(_blank_frame(), bbox)
        result = ma.analyze(_blank_frame(), bbox)
        assert result.stability_score == 1.0

    def test_large_face_shift_gives_low_stability(self):
        ma = MotionAnalyzer()
        ma.analyze(_blank_frame(), [0.0, 0.0, 100.0, 100.0])
        result = ma.analyze(_blank_frame(), [500.0, 400.0, 600.0, 500.0])
        assert result.stability_score < 0.5

    def test_stability_score_bounded_0_1(self):
        ma = MotionAnalyzer()
        ma.analyze(_blank_frame(), [0.0, 0.0, 10.0, 10.0])
        result = ma.analyze(_blank_frame(), [600.0, 450.0, 640.0, 480.0])
        assert 0.0 <= result.stability_score <= 1.0

    def test_no_face_bbox_keeps_prev_center(self):
        ma = MotionAnalyzer()
        ma.analyze(_blank_frame(), [100.0, 100.0, 200.0, 200.0])
        result = ma.analyze(_blank_frame(), None)
        # Without a new face center, stability falls back to 1.0
        assert result.stability_score == 1.0

    def test_invalid_bbox_ignored(self):
        ma = MotionAnalyzer()
        ma.analyze(_blank_frame())
        result = ma.analyze(_blank_frame(), [100.0, 100.0])  # too short
        assert isinstance(result, MotionResult)

    def test_prev_gray_updated_after_analyze(self):
        ma = MotionAnalyzer()
        frame = _blank_frame()
        ma.analyze(frame)
        assert ma.prev_gray is not None
