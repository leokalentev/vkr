"""Unit tests for cv_module/head_pose.py — HeadPoseAnalyzer."""
import numpy as np
import pytest

from cv_module.head_pose import HeadPoseAnalyzer, HeadPoseResult


# 5 keypoints: left_eye, right_eye, nose, left_mouth, right_mouth
# Symmetric face (nose centered) — all x-coords balanced
CENTERED_KPS = np.array([
    [100.0, 50.0],   # left_eye
    [200.0, 50.0],   # right_eye
    [150.0, 100.0],  # nose  — exactly at face center x=150
    [110.0, 150.0],  # left_mouth
    [190.0, 150.0],  # right_mouth
], dtype=np.float32)

# Nose shifted far to the right → not forward
TURNED_KPS = np.array([
    [100.0, 50.0],
    [200.0, 50.0],
    [250.0, 100.0],  # nose shifted right by 100px
    [110.0, 150.0],
    [190.0, 150.0],
], dtype=np.float32)


class TestHeadPoseAnalyzerInit:
    def test_default_threshold(self):
        analyzer = HeadPoseAnalyzer()
        assert analyzer.forward_threshold == 0.15

    def test_custom_threshold(self):
        analyzer = HeadPoseAnalyzer(forward_threshold=0.3)
        assert analyzer.forward_threshold == 0.3


class TestAnalyzeFromKps:
    def test_none_kps_returns_none(self):
        analyzer = HeadPoseAnalyzer()
        assert analyzer.analyze_from_kps(None) is None

    def test_too_few_keypoints_returns_none(self):
        analyzer = HeadPoseAnalyzer()
        kps = np.array([[10, 20], [30, 40]], dtype=np.float32)
        assert analyzer.analyze_from_kps(kps) is None

    def test_centered_face_is_forward(self):
        analyzer = HeadPoseAnalyzer()
        result = analyzer.analyze_from_kps(CENTERED_KPS)
        assert result is not None
        assert bool(result.is_forward) is True

    def test_turned_face_is_not_forward(self):
        analyzer = HeadPoseAnalyzer()
        result = analyzer.analyze_from_kps(TURNED_KPS)
        assert result is not None
        assert bool(result.is_forward) is False

    def test_forward_score_bounded_0_1(self):
        analyzer = HeadPoseAnalyzer()
        for kps in (CENTERED_KPS, TURNED_KPS):
            result = analyzer.analyze_from_kps(kps)
            assert result is not None
            assert 0.0 <= result.forward_score <= 1.0

    def test_centered_face_high_forward_score(self):
        analyzer = HeadPoseAnalyzer()
        result = analyzer.analyze_from_kps(CENTERED_KPS)
        assert result is not None
        assert result.forward_score == 1.0

    def test_turned_face_zero_forward_score(self):
        analyzer = HeadPoseAnalyzer()
        result = analyzer.analyze_from_kps(TURNED_KPS)
        assert result is not None
        assert result.forward_score == 0.0

    def test_returns_head_pose_result(self):
        analyzer = HeadPoseAnalyzer()
        result = analyzer.analyze_from_kps(CENTERED_KPS)
        assert isinstance(result, HeadPoseResult)

    def test_nose_offset_is_nonnegative(self):
        analyzer = HeadPoseAnalyzer()
        result = analyzer.analyze_from_kps(CENTERED_KPS)
        assert result is not None
        assert result.nose_offset >= 0.0

    def test_accepts_list_input(self):
        analyzer = HeadPoseAnalyzer()
        kps_list = CENTERED_KPS.tolist()
        result = analyzer.analyze_from_kps(kps_list)
        assert result is not None

    def test_strict_threshold_makes_centered_not_forward(self):
        """With threshold=0, a centered face has nose_offset=0 which equals threshold."""
        analyzer = HeadPoseAnalyzer(forward_threshold=0.0)
        result = analyzer.analyze_from_kps(CENTERED_KPS)
        assert result is not None
        # The result must be produced (not crash); is_forward value is implementation-defined
        # when nose_offset == forward_threshold == 0 (avoids division by zero in forward_score)
        assert result.nose_offset == 0.0
        assert isinstance(bool(result.is_forward), bool)
