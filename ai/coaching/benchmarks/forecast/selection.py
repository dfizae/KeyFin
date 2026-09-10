"""Selection and calibration read other users' July outcomes only."""

from collections.abc import Mapping, Sequence
from math import inf

from .contracts import Calibration, Family, Forecast, ForecastCase
from .scoring import excess, radius, summarize


def choose(candidates: Mapping[str, Sequence[Forecast]], truth: Mapping[str, float]) -> str:
    scores = {name: summarize(rows, truth) for name, rows in candidates.items()}
    ceiling = min(scores["fdt"].wape or 0, scores["all_mean"].wape or 0)
    eligible = [name for name, score in scores.items() if score.wape is not None and score.wape <= ceiling]
    return min(eligible, key=lambda name: (
        scores[name].wape, scores[name].wis if scores[name].wis is not None else inf, name,
    ))


def calibrate(
    fold: str, family: Family, rows: Sequence[Forecast],
    cases: Mapping[str, ForecastCase], truth: Mapping[str, float],
) -> Calibration:
    if not rows or any(cases[row.case_id].user == fold or cases[row.case_id].split != "development"
                       for row in rows):
        raise ValueError("Calibration requires other users' development cases")
    scores = [excess(row, cases[row.case_id], truth[row.case_id]) for row in rows]
    return Calibration(fold=fold, model=rows[0].model, family=family, count=len(rows),
                       radius=radius(scores), score_case_ids=tuple(row.case_id for row in rows))
