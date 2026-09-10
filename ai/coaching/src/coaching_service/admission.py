"""Bound numeric work before calling the original engine's full schema validator."""

from math import prod
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field

from coaching_service.errors import ServiceError
from coaching_service.schemas import JsonDocument


class OptimizationCost(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(extra="ignore")
    envelopes: tuple[str, ...] = ("외식", "쇼핑", "취미·여가")
    reduction_grid: tuple[float, ...] = (0, 0.1, 0.2)


class RequestCost(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(extra="ignore")
    mode: str
    paths: int = Field(default=400, strict=True, ge=20, le=400)
    horizon_days: int = Field(default=90, strict=True, ge=1, le=90)
    optimization: OptimizationCost = OptimizationCost()
    stress_scenarios: tuple[JsonDocument, ...] = ()


def admit(request: JsonDocument) -> None:
    cost = RequestCost.model_validate(request.root)
    branches = 1 + len(cost.stress_scenarios)
    if cost.mode == "risk" and "stress_scenarios" not in request.root:
        branches += 3
    if cost.mode == "what_if":
        branches += 1
    if cost.mode == "optimize":
        branches += prod(len(cost.optimization.reduction_grid) for _ in cost.optimization.envelopes)
    if cost.paths * cost.horizon_days * branches > 2_000_000:
        raise ServiceError("numeric_compute_budget_exceeded")
