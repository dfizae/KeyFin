"""Transparent point and central-80%-interval errors; no customer-accuracy gate."""

from coaching_service.forecast_validation_contracts import MetricValues, Quantiles


def calculate_metrics(
    forecasts: tuple[Quantiles, ...], actuals: tuple[int, ...], baselines: tuple[float, ...]
) -> MetricValues:
    """WIS uses one central 80% interval and the median, with denominator K+0.5.

    Positive bias means overprediction. WAPE is a ratio, not a percentage string;
    it is absent when the sum of actual consumption is zero. Baselines are point
    forecasts and consequently have no fabricated prediction interval or WIS.
    """
    n = len(forecasts)
    if not n or len(actuals) != n or len(baselines) != n:
        raise ValueError("nonempty_aligned_samples_required")
    errors = tuple(pred.p50 - actual for pred, actual in zip(forecasts, actuals, strict=True))
    baseline_errors = tuple(base - actual for base, actual in zip(baselines, actuals, strict=True))
    absolute_sum = sum(abs(error) for error in errors)
    baseline_absolute = sum(abs(error) for error in baseline_errors)
    actual_sum = sum(actuals)
    widths = tuple(pred.p90 - pred.p10 for pred in forecasts)
    scores = tuple(
        (
            0.5 * abs(pred.p50 - actual)
            + 0.1 * (pred.p90 - pred.p10 + 10 * max(pred.p10 - actual, actual - pred.p90, 0))
        )
        / 1.5
        for pred, actual in zip(forecasts, actuals, strict=True)
    )
    return MetricValues(
        sample_count=n,
        mae_krw=absolute_sum / n,
        wape=absolute_sum / actual_sum if actual_sum else None,
        bias_krw=sum(errors) / n,
        wis80_krw=sum(scores) / n,
        coverage80=sum(p.p10 <= y <= p.p90 for p, y in zip(forecasts, actuals, strict=True)) / n,
        mean_interval_width_krw=sum(widths) / n,
        baseline_mae_krw=baseline_absolute / n,
        baseline_wape=baseline_absolute / actual_sum if actual_sum else None,
        baseline_bias_krw=sum(baseline_errors) / n,
    )
