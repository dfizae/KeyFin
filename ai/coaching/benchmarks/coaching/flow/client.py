"""Trace real TCP calls and explicit pass/fail checks; never record authentication."""

import time
from typing import final

import httpx2

from benchmarks.coaching.flow.contracts import Check, Exchange, ModelObservation, RoutingObservation
from coaching_service.chat_answers import ChatAnswer
from coaching_service.llm_contract import Routing
from coaching_service.schemas import Coaching, JsonDocument


@final
class Flow:
    def __init__(self, client: httpx2.Client) -> None:
        self.client: httpx2.Client = client
        self.checks: list[Check] = []
        self.exchanges: list[Exchange] = []
        self.observations: list[ModelObservation] = []
        self.routes: list[RoutingObservation] = []

    def check(self, name: str, *, passed: bool) -> None:
        self.checks.append(Check(name=name, passed=passed))

    def request(
        self,
        stage: str,
        method: str,
        path: str,
        body: JsonDocument | None = None,
        *,
        key: str | None = None,
    ) -> JsonDocument:
        started = time.perf_counter()
        response = self.client.request(
            method,
            path,
            json=body.root if body else None,
            headers={"Idempotency-Key": key or stage},
            follow_redirects=False,
        )
        result = JsonDocument.model_validate_json(response.content)
        self.exchanges.append(
            Exchange(
                stage=stage,
                method=method,
                path=path,
                status=response.status_code,
                latency_ms=round((time.perf_counter() - started) * 1000, 3),
                request=body,
                response=result,
            )
        )
        self.check(stage + ":http", passed=response.status_code == 200)
        if response.status_code != 200:
            raise RuntimeError("unexpected_flow_http_status:" + stage)
        return result

    def observe(self, stage: str, answer: Coaching | ChatAnswer) -> None:
        self.observations.append(
            ModelObservation(
                stage=stage,
                source=answer.wording_source,
                model=answer.model,
                fallback_reason=answer.fallback_reason,
            )
        )
        match answer:
            case Coaching():
                route = answer.receipt.routing
                required = answer.receipt.numeric_request is not None
            case ChatAnswer():
                raw = answer.evidence.root.get("routing")
                route = JsonDocument.model_validate(raw) if raw is not None else None
                required = answer.answer_type in {"spending_history", "personal_context"}
        self.observe_route(stage, route, required=required)

    def observe_route(self, stage: str, route: JsonDocument | None, *, required: bool) -> None:
        parsed = Routing.model_validate(route.root) if route is not None else None
        self.routes.append(
            RoutingObservation(
                stage=stage,
                metadata_available=parsed is not None,
                mode=parsed.mode if parsed is not None else None,
                source=parsed.source if parsed is not None else None,
                fallback_reason=parsed.fallback_reason if parsed is not None else None,
            )
        )
        if required or parsed is not None:
            self.check(
                stage + ":router_accepted",
                passed=parsed is not None and parsed.source == "llm" and parsed.fallback_reason is None,
            )

    def turn(self, stage: str, session: str, question: str) -> JsonDocument:
        return self.request(
            stage, "POST", f"/v1/sessions/{session}/messages", JsonDocument({"question": question})
        )
