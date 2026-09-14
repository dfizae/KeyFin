"""Frozen contracts for a receipt-based, delayed-outcome forecast audit."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from coaching_service.periods import DateOnly
from coaching_service.schemas import Frozen, Identifier, JsonDocument, TwinIdentity

Amount = Annotated[int, Field(strict=True, ge=0, le=10**14)]
Finite = Annotated[float, Field(allow_inf_nan=False)]
Digest = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Origin = Literal["synthetic", "historical_real", "backend_attested_real"]
Tier = Literal["synthetic", "replay", "prospective_attested"]


class Quantiles(Frozen):
    p10: Amount
    p50: Amount
    p90: Amount

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if not self.p10 <= self.p50 <= self.p90:
            raise ValueError("unordered_quantiles")
        return self


class RegistrationRequest(Frozen):
    coaching_id: Identifier
    data_origin: Origin
    source_reference: str = Field(min_length=1, max_length=200)


class ObservationRequest(Frozen):
    """Backend completeness attestation; callers cannot submit an actual amount."""

    coverage_start: DateOnly
    coverage_end: DateOnly
    complete: Literal[True]
    source_reference: str = Field(min_length=1, max_length=200)


class Baseline(Frozen):
    method: Literal["observed_calendar_day_mean/v1"] = "observed_calendar_day_mean/v1"
    history_start: DateOnly
    history_end: DateOnly
    history_calendar_days: int = Field(ge=1)
    history_total_krw: Amount
    prediction_krw: Finite = Field(ge=0, le=10**14)


class Registration(Frozen):
    id: Identifier
    coaching_id: Identifier
    target: Literal["total_variable_consumption"] = "total_variable_consumption"
    target_version: Literal["purchase_time_consumption/v1"] = "purchase_time_consumption/v1"
    unit: Literal["KRW"] = "KRW"
    envelope: Literal["all"] = "all"
    issued_at: Finite
    registered_at: Finite
    cutoff: DateOnly
    forecast_start: DateOnly
    forecast_end: DateOnly
    horizon_days: int = Field(ge=1, le=90)
    identity: TwinIdentity
    engine_commit: str
    model: JsonDocument
    model_digest: Digest
    receipt_digest: Digest
    ingestion_received_at: Finite | None
    data_origin: Origin
    evidence_tier: Tier
    source_reference: str
    prediction: Quantiles
    baseline: Baseline
    real_accuracy_validated: Literal[False] = False


class Settlement(Frozen):
    registration: Registration
    settled_at: Finite
    actual_krw: Amount
    actual_transaction_count: int = Field(ge=0)
    observed_identity: TwinIdentity
    observed_digest: Digest
    source_reference: str
    coverage_complete_backend_attested: Literal[True] = True
    independent_human_oracle: Literal[False] = False


class MetricValues(Frozen):
    sample_count: int = Field(ge=1)
    mae_krw: Finite
    wape: Finite | None
    bias_krw: Finite
    wis80_krw: Finite
    coverage80: Finite
    mean_interval_width_krw: Finite
    baseline_mae_krw: Finite
    baseline_wape: Finite | None
    baseline_bias_krw: Finite


class MetricRequest(Frozen):
    registration_ids: tuple[Identifier, ...] = Field(min_length=1, max_length=100)


class MetricReport(Frozen):
    registration_ids: tuple[str, ...]
    selection: Literal["explicit_settled_ids_not_population_sample"] = (
        "explicit_settled_ids_not_population_sample"
    )
    source_references: tuple[str, ...]
    target: Literal["total_variable_consumption"] = "total_variable_consumption"
    unit: Literal["KRW"] = "KRW"
    horizon_days: int
    model_digest: Digest
    engine_commit: str
    baseline_method: Literal["observed_calendar_day_mean/v1"] = "observed_calendar_day_mean/v1"
    evidence_tier: Tier
    data_origin: Origin
    values: MetricValues
    overlapping_windows: bool
    non_overlapping_window_count: int
    confidence_interval: Literal["not_estimated_single_owner_dependent_windows"] = (
        "not_estimated_single_owner_dependent_windows"
    )
    real_accuracy_validated: Literal[False] = False
