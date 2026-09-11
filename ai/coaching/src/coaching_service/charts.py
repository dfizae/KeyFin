"""One owner-scoped input produces an auditable chart and GPU-backed wording."""

import time
from datetime import date
from typing import assert_never
from uuid import uuid4

import anyio

from coaching_service.chart_contract import ChartReceipt, ChartRequest, ChartResponse, budget_period
from coaching_service.chart_projection import Budgets, ChartInputs, project_chart
from coaching_service.chart_rendering import renderer_manifest
from coaching_service.chart_wording import chart_evidence
from coaching_service.coaching import CoachingCore
from coaching_service.engine import ENGINE_COMMIT
from coaching_service.llm_contract import Wording
from coaching_service.repository import Mutation, write
from coaching_service.schemas import JsonDocument
from coaching_service.store import Operation


class Charts:
    def __init__(self, core: CoachingCore) -> None:
        self.core: CoachingCore = core

    async def forecast(self, operation: Operation, request: ChartRequest) -> JsonDocument:
        async def action() -> Mutation:
            twin = (
                await anyio.to_thread.run_sync(
                    self.core.engine.create, request.data, operation.owner, limiter=self.core.engine_limit
                )
                if request.data is not None
                else await self.core.twin(operation.owner)
            )
            identity = await anyio.to_thread.run_sync(self.core.engine.identity, twin)
            period = budget_period(request.period_start, date.fromisoformat(identity.as_of))
            transactions = await anyio.to_thread.run_sync(self.core.engine.transactions, twin)
            budgets = Budgets.model_validate(twin.root.get("snapshot") or {})
            numeric_request = None
            numeric_result = None
            daily_prediction = None
            if period.as_of < period.horizon_end:
                numeric_request = JsonDocument(
                    {
                        "mode": "forecast",
                        "paths": request.paths,
                        "seed": request.seed,
                        "horizon_days": (period.horizon_end - period.as_of).days,
                    }
                )
                numeric_result, daily_prediction = await anyio.to_thread.run_sync(
                    self.core.engine.chart_numeric,
                    twin,
                    numeric_request,
                    limiter=self.core.engine_limit,
                )
            inputs = ChartInputs(
                id=uuid4().hex,
                question=request.question,
                period=period,
                transactions=transactions,
                budgets=budgets,
                paths=request.paths,
                seed=request.seed,
            )
            chart = project_chart(inputs, numeric_result, daily_prediction)
            if numeric_result is None:
                wording = Wording(
                    text="예산 기간이 종료되어 관측된 소비를 표시합니다.",
                    source="template",
                    model="not_called",
                    fallback_reason="period_complete",
                )
            else:
                # The model selects supplied fact IDs; full time series remain in the receipt.
                wording = await self.core.model.write(chart_evidence(chart))
            match wording.source:
                case "llm":
                    language = "AI 근거 선택 · 검증 문장"
                case "template":
                    language = "정형 안내 · AI 문장 미채택"
                case unreachable:
                    assert_never(unreachable)
            is_seed = bool(transactions) and all(row.source == "SEED" for row in transactions)
            source = "SEED 데이터" if is_seed else "입력 거래"
            meta = chart.meta.model_copy(update={"source_label": f"{source} · FDT 계산 · {language}"})
            chart = chart.model_copy(update={"answer": wording.text, "meta": meta})
            result = ChartResponse(
                id=chart.id,
                chart=chart,
                wording=wording,
                created_at=time.time(),
                receipt=ChartReceipt(
                    engine_commit=ENGINE_COMMIT,
                    renderer_commit=renderer_manifest().commit,
                    identity=identity,
                    numeric_request=numeric_request,
                    numeric_result=numeric_result,
                    daily_forecast=daily_prediction,
                ),
            )
            return Mutation(
                result=JsonDocument.model_validate_json(result.model_dump_json(by_alias=True)),
                writes=(write("chart/" + result.id, result),),
            )

        return await self.core.repository.mutate(operation, action)
