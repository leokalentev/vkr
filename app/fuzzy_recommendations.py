"""
Fuzzy-logic hobby recommendation engine.
Uses scikit-fuzzy when available; falls back to a pure-Python triangular
membership function approximation so the server starts even without numpy.
"""

from __future__ import annotations

HOBBIES: dict[str, dict] = {
    "sport":   {"label": "Спорт",                  "description": "Командные и индивидуальные виды спорта, фитнес, активный отдых на природе"},
    "art":     {"label": "Творчество и искусство", "description": "Рисование, лепка, дизайн, фотография, декор и другие визуальные искусства"},
    "music":   {"label": "Музыка",                 "description": "Игра на инструментах, вокал, создание и сведение музыки"},
    "reading": {"label": "Чтение и саморазвитие",  "description": "Книги, подкасты, онлайн-курсы, научно-популярная литература"},
    "tech":    {"label": "Технологии",             "description": "Программирование, робототехника, электроника, 3D-печать, игры"},
    "cooking": {"label": "Кулинария",              "description": "Готовка, выпечка, изучение кухонь мира, кулинарные эксперименты"},
}

TRAIT_WEIGHTS: dict[str, dict[str, float]] = {
    "Веселый":          {"sport": 0.70, "art": 0.50, "music": 0.70, "reading": 0.20, "tech": 0.20, "cooking": 0.60},
    "Грустный":         {"sport": 0.20, "art": 0.80, "music": 0.90, "reading": 0.80, "tech": 0.40, "cooking": 0.30},
    "Общительный":      {"sport": 0.60, "art": 0.50, "music": 0.60, "reading": 0.20, "tech": 0.30, "cooking": 0.80},
    "Замкнутый":        {"sport": 0.30, "art": 0.70, "music": 0.70, "reading": 0.90, "tech": 0.80, "cooking": 0.40},
    "Активный":         {"sport": 0.90, "art": 0.40, "music": 0.50, "reading": 0.20, "tech": 0.40, "cooking": 0.50},
    "Спокойный":        {"sport": 0.20, "art": 0.70, "music": 0.70, "reading": 0.90, "tech": 0.60, "cooking": 0.80},
    "Творческий":       {"sport": 0.30, "art": 0.95, "music": 0.80, "reading": 0.50, "tech": 0.50, "cooking": 0.70},
    "Аналитический":    {"sport": 0.30, "art": 0.40, "music": 0.40, "reading": 0.90, "tech": 0.95, "cooking": 0.40},
    "Добросердечный":   {"sport": 0.40, "art": 0.70, "music": 0.60, "reading": 0.60, "tech": 0.30, "cooking": 0.90},
    "Целеустремлённый": {"sport": 0.80, "art": 0.40, "music": 0.40, "reading": 0.70, "tech": 0.80, "cooking": 0.40},
}

ALL_TRAITS: list[str] = list(TRAIT_WEIGHTS.keys())


# ---------------------------------------------------------------------------
# Triangular membership function (pure Python, no numpy needed)
# ---------------------------------------------------------------------------
def _trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership: rises linearly from a to b, falls from b to c."""
    if x <= a or x >= c:
        return 0.0
    if x <= b:
        return (x - a) / (b - a) if b != a else 1.0
    return (c - x) / (c - b) if c != b else 1.0


def _centroid_defuzz(output_range: list[float], low_cut: float, med_cut: float, high_cut: float) -> float:
    """Mamdani centroid defuzzification over [0, 10] with three trimf sets."""
    # sets: low=[0,0,4], medium=[2,5,8], high=[6,10,10]
    numerator = 0.0
    denominator = 0.0
    for x in output_range:
        low  = min(low_cut,  _trimf(x, 0, 0, 4))
        med  = min(med_cut,  _trimf(x, 2, 5, 8))
        high = min(high_cut, _trimf(x, 6, 10, 10))
        agg  = max(low, med, high)
        numerator   += x * agg
        denominator += agg
    return numerator / denominator if denominator > 0 else 5.0


# Pre-compute output universe at 0.1 resolution
_OUT_RANGE = [i * 0.1 for i in range(101)]  # 0.0 … 10.0


def _fuzzy_score(raw: float) -> float:
    """Map a raw interest score (0–1) to a recommendation strength (0–10)."""
    x = max(0.0, min(1.0, raw))
    # Input membership functions: low=[0,0,0.45], medium=[0.25,0.5,0.75], high=[0.55,1,1]
    low_degree  = _trimf(x, 0.0, 0.0, 0.45)
    med_degree  = _trimf(x, 0.25, 0.5, 0.75)
    high_degree = _trimf(x, 0.55, 1.0, 1.0)

    # Rules: low→low, medium→medium, high→high
    return _centroid_defuzz(_OUT_RANGE, low_degree, med_degree, high_degree)


# ---------------------------------------------------------------------------
# Optional scikit-fuzzy override (same logic, but uses the library)
# ---------------------------------------------------------------------------
_skfuzzy_available = False
try:
    import numpy as np
    import skfuzzy as fuzz
    from skfuzzy import control as ctrl
    _skfuzzy_available = True
except ImportError:
    pass

_hobby_ctrl = None  # cached ControlSystem


def _build_hobby_ctrl():
    universe_in  = np.arange(0, 1.01,  0.01)  # type: ignore[name-defined]
    universe_out = np.arange(0, 10.01, 0.01)  # type: ignore[name-defined]

    interest      = ctrl.Antecedent(universe_in,  "interest")     # type: ignore[name-defined]
    recommendation = ctrl.Consequent(universe_out, "recommendation")  # type: ignore[name-defined]

    interest["low"]    = fuzz.trimf(interest.universe,      [0.0,  0.0,  0.45])  # type: ignore[name-defined]
    interest["medium"] = fuzz.trimf(interest.universe,      [0.25, 0.5,  0.75])  # type: ignore[name-defined]
    interest["high"]   = fuzz.trimf(interest.universe,      [0.55, 1.0,  1.0])   # type: ignore[name-defined]

    recommendation["low"]    = fuzz.trimf(recommendation.universe, [0, 0,  4])   # type: ignore[name-defined]
    recommendation["medium"] = fuzz.trimf(recommendation.universe, [2, 5,  8])   # type: ignore[name-defined]
    recommendation["high"]   = fuzz.trimf(recommendation.universe, [6, 10, 10])  # type: ignore[name-defined]

    rules = [
        ctrl.Rule(interest["low"],    recommendation["low"]),    # type: ignore[name-defined]
        ctrl.Rule(interest["medium"], recommendation["medium"]),  # type: ignore[name-defined]
        ctrl.Rule(interest["high"],   recommendation["high"]),    # type: ignore[name-defined]
    ]
    return ctrl.ControlSystem(rules)  # type: ignore[name-defined]


def _fuzzy_score_skfuzzy(raw: float) -> float:
    global _hobby_ctrl
    if _hobby_ctrl is None:
        _hobby_ctrl = _build_hobby_ctrl()
    sim = ctrl.ControlSystemSimulation(_hobby_ctrl)  # type: ignore[name-defined]
    sim.input["interest"] = float(np.clip(raw, 0.01, 0.99))  # type: ignore[name-defined]
    sim.compute()
    return float(sim.output["recommendation"])


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def get_hobby_recommendations(traits: list[str]) -> list[dict]:
    valid = [t for t in traits if t in TRAIT_WEIGHTS]
    if not valid:
        return []

    scorer = _fuzzy_score_skfuzzy if _skfuzzy_available else _fuzzy_score

    results = []
    for hobby_key, info in HOBBIES.items():
        raw = sum(TRAIT_WEIGHTS[t][hobby_key] for t in valid) / len(valid)
        score = scorer(raw)
        results.append({
            "hobby": info["label"],
            "description": info["description"],
            "score": round(score, 2),
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results
