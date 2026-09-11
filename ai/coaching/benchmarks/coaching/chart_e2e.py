"""Exercise a real chart API; put supplied cases, tokens and outputs outside Git."""

import json
import os
import sys
import time
from collections import Counter
from pathlib import Path
from uuid import uuid4

import anyio
from pydantic import SecretStr, TypeAdapter

from coaching_service.chart_contract import ChartRequest, ChartResponse
from coaching_service.llm import create_http_client
from coaching_service.llm_contract import ModelConfig
from coaching_service.schemas import Frozen, Identifier


class Case(Frozen):
    id: Identifier
    owner: str
    request: ChartRequest


class Outcome(Frozen):
    case: str
    seconds: float
    wording_source: str
    fallback_reason: str | None
    future_days: int
    chart_id: str


async def run(inputs: Path, output: Path) -> None:
    cases = TypeAdapter(tuple[Case, ...]).validate_json(await anyio.Path(inputs).read_bytes())
    tokens = TypeAdapter(dict[str, SecretStr]).validate_json(
        await anyio.Path(os.environ["COACHING_CHART_TOKENS_FILE"]).read_bytes(),
    )
    base = os.environ["COACHING_CHART_URL"].rstrip("/")
    destination = anyio.Path(output)
    await destination.mkdir(parents=True, exist_ok=False)
    outcomes: list[Outcome] = []
    async with create_http_client(ModelConfig(timeout_seconds=120.0, read_timeout_seconds=120.0)) as client:
        for case in cases:
            headers = {
                "Authorization": "Bearer " + tokens[case.owner].get_secret_value(),
                "Idempotency-Key": uuid4().hex,
            }
            started = time.perf_counter()
            response = await client.post(
                base + "/v1/charts/budget-forecast",
                content=case.request.model_dump_json(),
                headers={**headers, "Content-Type": "application/json"},
            )
            response.raise_for_status()
            result = ChartResponse.model_validate_json(response.content)
            duration = time.perf_counter() - started
            numeric = result.receipt.numeric_result
            if numeric is None or result.chart.total_forecast != result.chart.balance.terminal.p50_krw:
                raise RuntimeError("missing_or_inconsistent_forecast")
            artifact = destination / case.id
            await artifact.mkdir()
            await (artifact / "response.json").write_bytes(response.content)
            await (artifact / "chart.json").write_text(
                result.chart.model_dump_json(by_alias=True), encoding="utf-8"
            )
            page = await client.get(base + f"/v1/charts/{result.id}/html", headers=headers)
            page.raise_for_status()
            await (artifact / "index.html").write_bytes(page.content)
            saved = await client.get(base + f"/v1/charts/{result.id}", headers=headers)
            saved.raise_for_status()
            if ChartResponse.model_validate_json(saved.content) != result:
                raise RuntimeError("saved_chart_mismatch")
            retry = await client.post(
                base + "/v1/charts/budget-forecast",
                content=case.request.model_dump_json(),
                headers={**headers, "Content-Type": "application/json"},
            )
            retry.raise_for_status()
            if ChartResponse.model_validate_json(retry.content) != result:
                raise RuntimeError("idempotent_chart_mismatch")
            outcomes.append(
                Outcome(
                    case=case.id,
                    seconds=round(duration, 6),
                    wording_source=result.wording.source,
                    fallback_reason=result.wording.fallback_reason,
                    future_days=(result.chart.meta.horizon_end - result.chart.meta.as_of).days,
                    chart_id=result.id,
                )
            )
        unauthorized = await client.get(base + f"/v1/charts/{outcomes[0].chart_id}")
        if unauthorized.status_code != 401:
            raise RuntimeError("authentication_contract_mismatch")
    summary = {
        "cases": len(outcomes),
        "outcomes": [r.model_dump() for r in outcomes],
        "wording_sources": dict(Counter(r.wording_source for r in outcomes)),
        "html_and_saved_json_and_retry_verified": len(outcomes),
        "unauthorized_status": 401,
    }
    await (destination / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    sys.stdout.write(json.dumps(summary, ensure_ascii=False) + "\nCHART_E2E_PASS\n")


if __name__ == "__main__":
    anyio.run(run, Path(sys.argv[1]), Path(sys.argv[2]))
