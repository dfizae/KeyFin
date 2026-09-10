"""Exercise the real service adapter; this file does not implement a forecast."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from coaching_service.engine import EngineAdapter
from coaching_service.schemas import Bootstrap, JsonDocument

from .contracts import EngineOutput
from .ledger import ENVELOPES

if TYPE_CHECKING:
    from datetime import date

    from .contracts import LedgerRow


@dataclass(frozen=True, slots=True)
class Request:
    cutoff: date
    horizon_days: int
    budget_krw: int = 100_000
    seed: int = 42


@dataclass(frozen=True, slots=True)
class Execution:
    output: EngineOutput
    raw: JsonDocument
    bootstrap: Bootstrap
    request: JsonDocument


def execute(rows: tuple[LedgerRow, ...], request: Request) -> Execution:
    """Execute already partitioned input at the real service boundary."""
    bootstrap = Bootstrap.model_validate({
        "as_of": request.cutoff.isoformat(),
        "transactions": [row.model_dump(mode="json") for row in rows],
        "snapshot": {
            "as_of": request.cutoff.isoformat(), "source": "USER_ASSUMPTION", "accounts": [],
            "budgets": dict.fromkeys(ENVELOPES, request.budget_krw),
        },
        "envelopes": [],
    })
    numeric = JsonDocument.model_validate({
        "mode": "risk", "horizon_days": request.horizon_days, "paths": 400,
        "seed": request.seed, "stress_scenarios": [],
    })
    adapter = EngineAdapter()
    document = adapter.create(bootstrap, rows[0].user_id)
    raw = adapter.numeric(document, numeric)
    return Execution(EngineOutput.model_validate(raw.root), raw, bootstrap, numeric)
