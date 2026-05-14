"""Unit tests for cv_module/realtime.py — RealtimeSession aggregation logic."""
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from cv_module.realtime import RealtimeSession, decode_frame
from cv_module.head_pose import HeadPoseResult
from cv_module.motion import MotionResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_session(**kwargs) -> RealtimeSession:
    defaults = dict(
        session_id="test-session",
        lesson_id=1,
        student_id=1,
        teacher_id=2,
        template_embedding=np.ones(512, dtype=np.float32),
    )
    defaults.update(kwargs)
    return RealtimeSession(**defaults)


def _make_face_engine(similarity=0.85):
    engine = MagicMock()
    face = MagicMock()
    face.bbox = [10.0, 10.0, 100.0, 100.0]
    face.embedding = np.ones(512, dtype=np.float32)
    face.kps = np.array([
        [50.0, 30.0], [100.0, 30.0], [75.0, 60.0],
        [55.0, 90.0], [95.0, 90.0],
    ], dtype=np.float32)
    engine.get_primary_face.return_value = face
    engine.cosine_similarity.return_value = similarity
    return engine


def _make_pose_analyzer(is_forward=True, nose_offset=0.05):
    analyzer = MagicMock()
    analyzer.analyze_from_kps.return_value = HeadPoseResult(
        forward_score=1.0 if is_forward else 0.0,
        is_forward=is_forward,
        nose_offset=nose_offset,
    )
    return analyzer


def _blank_frame(h=48, w=64):
    return np.zeros((h, w, 3), dtype=np.uint8)


# ---------------------------------------------------------------------------
# decode_frame
# ---------------------------------------------------------------------------

class TestDecodeFrame:
    def test_invalid_bytes_returns_none(self):
        assert decode_frame(b"not an image") is None

    def test_empty_bytes_returns_none(self):
        assert decode_frame(b"") is None


# ---------------------------------------------------------------------------
# RealtimeSession.process_frame
# ---------------------------------------------------------------------------

class TestProcessFrame:
    def test_increments_frames_processed(self):
        session = _make_session()
        engine = _make_face_engine()
        pose = _make_pose_analyzer()
        session.process_frame(_blank_frame(), engine, pose)
        assert session.frames_processed == 1

    def test_increments_detected_count_when_face_found(self):
        session = _make_session()
        session.process_frame(_blank_frame(), _make_face_engine(), _make_pose_analyzer())
        assert session.detected_count == 1

    def test_no_increment_when_no_face(self):
        session = _make_session()
        engine = MagicMock()
        engine.get_primary_face.return_value = None
        session.process_frame(_blank_frame(), engine, _make_pose_analyzer())
        assert session.detected_count == 0

    def test_matched_count_increases_when_similarity_above_threshold(self):
        session = _make_session()
        session.process_frame(_blank_frame(), _make_face_engine(similarity=0.9), _make_pose_analyzer())
        assert session.matched_count == 1

    def test_matched_count_zero_when_similarity_below_threshold(self):
        session = _make_session()
        session.process_frame(_blank_frame(), _make_face_engine(similarity=0.1), _make_pose_analyzer())
        assert session.matched_count == 0

    def test_forward_count_increases_when_pose_forward(self):
        session = _make_session()
        session.process_frame(_blank_frame(), _make_face_engine(), _make_pose_analyzer(is_forward=True))
        assert session.forward_count == 1

    def test_forward_count_zero_when_not_forward(self):
        session = _make_session()
        session.process_frame(_blank_frame(), _make_face_engine(), _make_pose_analyzer(is_forward=False))
        assert session.forward_count == 0

    def test_disappearance_counted_when_face_lost(self):
        session = _make_session()
        engine_with_face = _make_face_engine()
        engine_without_face = MagicMock()
        engine_without_face.get_primary_face.return_value = None

        session.process_frame(_blank_frame(), engine_with_face, _make_pose_analyzer())
        session.process_frame(_blank_frame(), engine_without_face, _make_pose_analyzer())
        assert session.disappearance_count == 1

    def test_result_dict_contains_expected_keys(self):
        session = _make_session()
        result = session.process_frame(_blank_frame(), _make_face_engine(), _make_pose_analyzer())
        for key in ("frame", "face_detected", "similarity", "is_forward", "motion_score"):
            assert key in result

    def test_motion_scores_accumulate(self):
        session = _make_session()
        for _ in range(3):
            session.process_frame(_blank_frame(), _make_face_engine(), _make_pose_analyzer())
        assert len(session.motion_scores) == 3


# ---------------------------------------------------------------------------
# RealtimeSession.aggregate
# ---------------------------------------------------------------------------

class TestAggregate:
    def _session_with_n_frames(self, n, similarity=0.85, is_forward=True):
        session = _make_session()
        engine = _make_face_engine(similarity=similarity)
        pose = _make_pose_analyzer(is_forward=is_forward)
        for _ in range(n):
            session.process_frame(_blank_frame(), engine, pose)
        return session

    def test_presence_ratio_all_detected(self):
        session = self._session_with_n_frames(10)
        result = session.aggregate()
        assert result["engagement_payload"]["presence_ratio"] == 1.0

    def test_presence_ratio_none_detected(self):
        session = _make_session()
        engine = MagicMock()
        engine.get_primary_face.return_value = None
        pose = _make_pose_analyzer()
        for _ in range(10):
            session.process_frame(_blank_frame(), engine, pose)
        result = session.aggregate()
        assert result["engagement_payload"]["presence_ratio"] == 0.0

    def test_attendance_present_when_high_presence_and_similarity(self):
        session = self._session_with_n_frames(20, similarity=0.85)
        result = session.aggregate()
        assert result["attendance_payload"]["status"] == "present"

    def test_attendance_absent_when_low_presence(self):
        session = _make_session()
        engine_face = _make_face_engine(similarity=0.9)
        engine_none = MagicMock()
        engine_none.get_primary_face.return_value = None
        pose = _make_pose_analyzer()
        # Only 2 out of 10 frames have face → presence_ratio = 0.2 < 0.7
        for _ in range(2):
            session.process_frame(_blank_frame(), engine_face, pose)
        for _ in range(8):
            session.process_frame(_blank_frame(), engine_none, pose)
        result = session.aggregate()
        assert result["attendance_payload"]["status"] == "absent"

    def test_head_pose_forward_ratio(self):
        session = self._session_with_n_frames(10, is_forward=True)
        result = session.aggregate()
        assert result["engagement_payload"]["head_pose_forward_ratio"] == 1.0

    def test_frame_stability_perfect_when_no_disappearances(self):
        session = self._session_with_n_frames(10)
        result = session.aggregate()
        assert result["engagement_payload"]["frame_stability"] == 1.0

    def test_aggregate_returns_three_keys(self):
        session = self._session_with_n_frames(5)
        result = session.aggregate()
        assert "engagement_payload" in result
        assert "attendance_payload" in result
        assert "meta" in result

    def test_engagement_payload_contains_frame_count(self):
        session = self._session_with_n_frames(7)
        result = session.aggregate()
        assert result["engagement_payload"]["frame_count"] == 7

    def test_grade_score_passed_through(self):
        session = self._session_with_n_frames(5)
        result = session.aggregate(grade_score=0.75)
        assert result["engagement_payload"]["grade_score"] == 0.75

    def test_grade_score_none_when_not_provided(self):
        session = self._session_with_n_frames(5)
        result = session.aggregate()
        assert result["engagement_payload"]["grade_score"] is None

    def test_face_match_confidence_is_mean_similarity(self):
        session = _make_session()
        engine = _make_face_engine(similarity=0.8)
        pose = _make_pose_analyzer()
        for _ in range(4):
            session.process_frame(_blank_frame(), engine, pose)
        result = session.aggregate()
        conf = result["engagement_payload"]["face_match_confidence"]
        assert abs(conf - 0.8) < 0.01

    def test_disappearances_count_in_meta(self):
        session = _make_session()
        engine_face = _make_face_engine()
        engine_none = MagicMock()
        engine_none.get_primary_face.return_value = None
        pose = _make_pose_analyzer()
        session.process_frame(_blank_frame(), engine_face, pose)
        session.process_frame(_blank_frame(), engine_none, pose)
        session.process_frame(_blank_frame(), engine_face, pose)
        session.process_frame(_blank_frame(), engine_none, pose)
        result = session.aggregate()
        assert result["meta"]["disappearances"] == 2
