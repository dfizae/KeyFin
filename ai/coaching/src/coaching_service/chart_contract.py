"""Typed wire contract for the existing KeyFin Chart 2.0 renderer."""

import calendar
from datetime import date, timedelta
from typing import Annotated, ClassVar, Literal

from pydantic import ConfigDict, Field
from pydantic.alias_generators import to_camel

from coaching_service.errors import ServiceError
from coaching_service.llm_contract import Wording
from coaching_service.periods import DateOnly
from coaching_service.schemas import Bootstrap, Frozen, JsonDocument, TwinIdentity

ChartMoney = Annotated[int, Field(strict=True, ge=-9007199254740991, le=9007199254740991)]


class ChartRequest(Frozen):
    data: Bootstrap | None = None
    period_start: DateOnly
    question: str = Field(default="예산 기간의 예상 소비를 보여 주세요.", min_length=1, max_length=2000)
    paths: int = Field(default=400, ge=20, le=400)
    seed: int = Field(default=42, ge=0, le=4294967295)


class BudgetPeriod(Frozen):
    period_start: date
    as_of: date
    horizon_end: date


def budget_period(start: date, as_of: date) -> BudgetPeriod:
    try:
        year, month = (start.year + 1, 1) if start.month == 12 else (start.year, start.month + 1)
        boundary = date(year, month, min(start.day, calendar.monthrange(year, month)[1]))
        end = boundary - timedelta(days=1)
    except (ValueError, OverflowError):
        raise ServiceError("chart_period_out_of_range", 422) from None
    if not start <= as_of <= end:
        raise ServiceError("chart_reference_outside_period", 422)
    return BudgetPeriod(period_start=start, as_of=as_of, horizon_end=end)


class Category(Frozen):
    id: str
    label: str
    budget: ChartMoney | None
    current: ChartMoney
    forecast: ChartMoney


class HistoricalPoint(Frozen):
    date: date
    value_krw: ChartMoney


class Quantile(Frozen):
    p50_krw: ChartMoney


class ForecastPoint(Quantile):
    date: date


class DailyPoint(Frozen):
    date: date
    amounts_krw: tuple[ChartMoney, ...]


class Balance(Frozen):
    kind: Literal["cumulative_expense"] = "cumulative_expense"
    budget_krw: ChartMoney | None
    current_krw: ChartMoney
    terminal: Quantile
    history: tuple[HistoricalPoint, ...]
    forecast: tuple[ForecastPoint, ...]
    daily: tuple[DailyPoint, ...]


class ChartMeta(BudgetPeriod):
    source_label: str = "입력 거래 기반 FDT 계산 · AI 설명 · 실제 예측 정확도 미검증"
    coverage: Literal["variable_consumption_excluding_fixed"] = "variable_consumption_excluding_fixed"
    history_coverage_verified: Literal[False] = False
    daily_note: str = "분류된 변동소비의 관측 기록입니다. 미분류 소비와 미래 일별 구성은 제공하지 않습니다."
    aggregation_note: str = (
        "고정비 제외·미분류 포함 구매시점 변동소비입니다. 전체 P50은 봉투별 P50의 합이 아닙니다. "
        "거래가 없는 날은 입력 자료 안에서 0으로 처리하며, 거래 누락 여부는 확인되지 않았습니다."
    )
    calibrated: Literal[False] = False
    paths: int
    seed: int
    status: str


class ChartResult(Frozen):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        frozen=True,
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )
    schema_version: Literal["2.0"] = Field(default="2.0", alias="schema_version")
    value_semantics: Literal["period_total"] = Field(default="period_total", alias="value_semantics")
    forecast_aggregation: Literal["joint_p50"] = "joint_p50"
    id: str
    question: str
    answer: str = ""
    source: str = "fdt_coaching_chart_api"
    total_budget: ChartMoney | None
    total_current: ChartMoney
    unallocated_current: ChartMoney
    total_forecast: ChartMoney
    categories: tuple[Category, ...]
    meta: ChartMeta
    balance: Balance


class ChartReceipt(Frozen):
    contract_version: Literal["keyfin-chart-receipt/1"] = "keyfin-chart-receipt/1"
    engine_commit: str
    renderer_commit: str
    identity: TwinIdentity
    numeric_request: JsonDocument | None
    numeric_result: JsonDocument | None


class ChartResponse(Frozen):
    id: str
    chart: ChartResult
    wording: Wording
    receipt: ChartReceipt
    created_at: float
