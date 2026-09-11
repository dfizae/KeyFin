"""Convert engine amounts once; neither language models nor renderers invent numbers."""

from datetime import date, timedelta
from typing import ClassVar, Final

from pydantic import BaseModel, ConfigDict, Field

from coaching_service.chart_contract import (
    Balance,
    BudgetPeriod,
    Category,
    ChartMeta,
    ChartMoney,
    ChartResult,
    DailyPoint,
    ForecastPoint,
    HistoricalPoint,
    Quantile,
)
from coaching_service.errors import ServiceError
from coaching_service.schemas import JsonDocument, TransactionView

ENVELOPES: Final = ("외식", "교통비", "의료·건강", "취미·여가", "쇼핑", "편의점·마트·잡화", "기타")
LABELS: Final = ("외식", "교통", "의료·건강", "취미·여가", "쇼핑", "마트·편의점", "기타")


class EngineFields(BaseModel):
    """Parse only the numeric fields needed from a preserved upstream document."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="ignore", frozen=True)


class Metric(EngineFields):
    value: ChartMoney


class EnvelopeForecast(EngineFields):
    envelope: str
    p50_krw: ChartMoney


class ProjectionPoint(EngineFields):
    date: date
    cumulative_expense_p50_krw: ChartMoney


class Datasets(EngineFields):
    envelopes: tuple[EnvelopeForecast, ...]
    projection: tuple[ProjectionPoint, ...]


class Metrics(EngineFields):
    total_expense_p50_krw: Metric


class NumericResult(EngineFields):
    status: str
    datasets: Datasets
    metrics: Metrics


class Budgets(EngineFields):
    budgets: dict[str, ChartMoney] = Field(default_factory=dict)


class ChartInputs(EngineFields):
    id: str
    question: str
    period: BudgetPeriod
    transactions: tuple[TransactionView, ...]
    budgets: Budgets
    paths: int
    seed: int


def project_chart(inputs: ChartInputs, raw: JsonDocument | None) -> ChartResult:
    period = inputs.period
    transactions = tuple(
        t
        for t in inputs.transactions
        if t.active
        and t.kind == "expense"
        and period.period_start.isoformat() <= t.date <= period.as_of.isoformat()
    )
    daily: list[DailyPoint] = []
    history: list[HistoricalPoint] = []
    cumulative = 0
    for offset in range((period.as_of - period.period_start).days + 1):
        day = period.period_start + timedelta(days=offset)
        rows = tuple(t for t in transactions if t.date == day.isoformat())
        amounts = tuple(
            sum(t.amount_krw for t in rows if not t.pending and t.envelope == name) for name in ENVELOPES
        )
        daily.append(DailyPoint(date=day, amounts_krw=amounts))
        cumulative += sum(t.amount_krw for t in rows)
        history.append(HistoricalPoint(date=day, value_krw=cumulative))
    current = tuple(sum(row.amounts_krw[i] for row in daily) for i in range(len(ENVELOPES)))
    future = dict.fromkeys(ENVELOPES, 0)
    forecast = (ForecastPoint(date=period.as_of, p50_krw=cumulative),)
    status = "observed_period_complete"
    if raw is not None:
        result = NumericResult.model_validate(raw.root)
        if result.status not in {"ok", "partial"}:
            raise ServiceError("chart_forecast_unavailable", 422)
        future = {row.envelope: row.p50_krw for row in result.datasets.envelopes}
        if set(future) != set(ENVELOPES) or len(result.datasets.envelopes) != len(ENVELOPES):
            raise ServiceError("chart_envelope_contract_mismatch", 502)
        forecast = tuple(
            ForecastPoint(date=row.date, p50_krw=cumulative + row.cumulative_expense_p50_krw)
            for row in result.datasets.projection
        )
        expected_dates = tuple(
            period.as_of + timedelta(days=i) for i in range((period.horizon_end - period.as_of).days + 1)
        )
        if tuple(point.date for point in forecast) != expected_dates or forecast[0].p50_krw != cumulative:
            raise ServiceError("chart_projection_contract_mismatch", 502)
        if forecast[-1].p50_krw != cumulative + result.metrics.total_expense_p50_krw.value:
            raise ServiceError("chart_terminal_contract_mismatch", 502)
        status = result.status
    categories = tuple(
        Category(
            id=name,
            label=label,
            budget=inputs.budgets.budgets.get(name),
            current=used,
            forecast=used + future[name],
        )
        for name, label, used in zip(ENVELOPES, LABELS, current, strict=True)
    )
    total_budget = (
        sum(inputs.budgets.budgets.values()) if set(inputs.budgets.budgets) == set(ENVELOPES) else None
    )
    terminal = forecast[-1].p50_krw
    return ChartResult(
        id=inputs.id,
        question=inputs.question,
        total_budget=total_budget,
        total_current=cumulative,
        unallocated_current=cumulative - sum(current),
        total_forecast=terminal,
        categories=categories,
        meta=ChartMeta(
            period_start=period.period_start,
            as_of=period.as_of,
            horizon_end=period.horizon_end,
            paths=inputs.paths,
            seed=inputs.seed,
            status=status,
        ),
        balance=Balance(
            budget_krw=total_budget,
            current_krw=cumulative,
            terminal=Quantile(p50_krw=terminal),
            history=tuple(history),
            forecast=forecast,
            daily=tuple(daily),
        ),
    )
