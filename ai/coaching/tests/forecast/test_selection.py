from datetime import date

from benchmarks.forecast.contracts import Forecast, ForecastCase
from benchmarks.forecast.selection import calibrate, choose


def test_selection_uses_development_error_and_respects_both_baselines() -> None:
    truth = {"july": 100.0}
    candidates = {name: [Forecast(case_id="july", model=name, point=point)]
                  for name, point in (("fdt", 120), ("all_mean", 110), ("candidate", 101))}
    assert choose(candidates, truth) == "candidate"


def test_calibration_records_only_provided_development_cases() -> None:
    case = ForecastCase(case_id="july", user="other", envelope="food", split="development",
                        family="days7", first_date=date(2026, 6, 30), cutoff=date(2026, 7, 1),
                        end_date=date(2026, 7, 8), horizon=7, history=(100.0, 100.0))
    row = Forecast(case_id="july", model="all_mean", point=700)
    result = calibrate("heldout", "days7", [row], {"july": case}, {"july": 1400})
    assert result.score_case_ids == ("july",)
    assert result.radius == 0.7
