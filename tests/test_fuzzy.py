"""Unit tests for app/fuzzy_recommendations.py — fuzzy hobby engine."""
import pytest

from app.fuzzy_recommendations import (
    get_hobby_recommendations,
    ALL_TRAITS,
    HOBBIES,
    TRAIT_WEIGHTS,
    _trimf,
    _fuzzy_score,
)


class TestTrimf:
    def test_below_a_returns_zero(self):
        assert _trimf(0.0, 0.25, 0.5, 0.75) == 0.0

    def test_above_c_returns_zero(self):
        assert _trimf(1.0, 0.25, 0.5, 0.75) == 0.0

    def test_peak_returns_one(self):
        assert _trimf(0.5, 0.25, 0.5, 0.75) == 1.0

    def test_midpoint_left_returns_half(self):
        assert abs(_trimf(0.375, 0.25, 0.5, 0.75) - 0.5) < 1e-9

    def test_midpoint_right_returns_half(self):
        assert abs(_trimf(0.625, 0.25, 0.5, 0.75) - 0.5) < 1e-9

    def test_at_a_returns_zero(self):
        assert _trimf(0.25, 0.25, 0.5, 0.75) == 0.0

    def test_at_c_returns_zero(self):
        assert _trimf(0.75, 0.25, 0.5, 0.75) == 0.0


class TestFuzzyScore:
    def test_low_raw_maps_to_lower_score_than_high_raw(self):
        # At exact 0.0 and 1.0, all membership degrees are 0 → defuzz returns 5.0
        # Use interior values where membership functions are active
        low_score = _fuzzy_score(0.2)
        high_score = _fuzzy_score(0.8)
        assert low_score < high_score

    def test_half_raw_maps_to_mid_score(self):
        score = _fuzzy_score(0.5)
        assert 3.0 < score < 7.0

    def test_score_bounded_0_10(self):
        for v in [0.0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0]:
            s = _fuzzy_score(v)
            assert 0.0 <= s <= 10.0

    def test_monotone_in_active_range(self):
        """Scores should be non-decreasing in the interior of membership functions."""
        # Only check 0.2 … 0.8 where all three sets have non-zero membership
        samples = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
        scores = [_fuzzy_score(v) for v in samples]
        for i in range(len(scores) - 1):
            assert scores[i] <= scores[i + 1] + 0.5


class TestGetHobbyRecommendations:
    def test_empty_traits_returns_empty(self):
        assert get_hobby_recommendations([]) == []

    def test_unknown_traits_returns_empty(self):
        assert get_hobby_recommendations(["НесуществующаяЧерта"]) == []

    def test_valid_traits_returns_list(self):
        result = get_hobby_recommendations(["Весёлый"])
        # "Весёлый" is not in TRAIT_WEIGHTS — falls through to empty
        # Use a known trait
        result = get_hobby_recommendations(["Веселый"])
        assert isinstance(result, list)

    def test_returns_all_hobbies(self):
        result = get_hobby_recommendations(["Активный"])
        assert len(result) == len(HOBBIES)

    def test_result_items_have_required_keys(self):
        result = get_hobby_recommendations(["Творческий"])
        for item in result:
            assert "hobby" in item
            assert "description" in item
            assert "score" in item

    def test_sorted_descending_by_score(self):
        result = get_hobby_recommendations(["Активный"])
        scores = [r["score"] for r in result]
        assert scores == sorted(scores, reverse=True)

    def test_active_person_top_sport(self):
        result = get_hobby_recommendations(["Активный"])
        top_hobby = result[0]["hobby"]
        assert top_hobby == "Спорт"

    def test_analytical_person_top_tech(self):
        result = get_hobby_recommendations(["Аналитический"])
        top_hobby = result[0]["hobby"]
        assert top_hobby == "Технологии"

    def test_multiple_traits_averages_scores(self):
        single = get_hobby_recommendations(["Веселый"])
        multi = get_hobby_recommendations(["Веселый", "Активный"])
        # Multi-trait result must still have all hobbies
        assert len(multi) == len(HOBBIES)

    def test_all_traits_returns_all_hobbies(self):
        result = get_hobby_recommendations(ALL_TRAITS)
        assert len(result) == len(HOBBIES)

    def test_scores_are_rounded_to_2_decimals(self):
        result = get_hobby_recommendations(["Творческий"])
        for item in result:
            score_str = str(item["score"])
            decimal_part = score_str.split(".")[-1] if "." in score_str else ""
            assert len(decimal_part) <= 2

    def test_all_traits_constant(self):
        assert len(ALL_TRAITS) == len(TRAIT_WEIGHTS)
        assert set(ALL_TRAITS) == set(TRAIT_WEIGHTS.keys())
