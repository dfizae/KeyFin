"""Bounded OpenAI-compatible inference; original engine outputs remain authoritative."""

from __future__ import annotations

import json
import re
import socket
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final, assert_never, cast

import anyio
import httpx2

from coaching_service.chart_wording import ChartSelection, selected_chart_wording
from coaching_service.evidence import context_limited, operation_evidence
from coaching_service.finance_knowledge import FinanceSelection, selected_finance_wording
from coaching_service.llm_contract import (
    CompletionEnvelope,
    EvidenceInput,
    Judgment,
    JudgmentDraft,
    ModelConfig,
    Operation,
    Routing,
    RoutingDraft,
    Wording,
)
from coaching_service.llm_prompt import TEMPLATE_TEXT, system_prompt, user_payload, wording_problem
from coaching_service.token_budget import BudgetFailure, check_token_budget

if TYPE_CHECKING:
    from pydantic import BaseModel, JsonValue

_LIMITS: Final = httpx2.Limits(max_connections=200, max_keepalive_connections=40, keepalive_expiry=30)
_JSON_FENCE: Final = re.compile(r"```(?:json)?\r?\n(.*?)\r?\n```", re.DOTALL)


def unique_json_object(pairs: list[tuple[str, JsonValue]]) -> dict[str, JsonValue]:
    result: dict[str, JsonValue] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def structured_json(text: str) -> str:
    """Remove only one complete JSON fence; preserve all strict parsing requirements."""
    candidate = text.strip()
    fenced = _JSON_FENCE.fullmatch(candidate)
    if fenced is not None and "```" not in fenced[1]:
        candidate = fenced[1]
    _ = cast("object", json.loads(candidate, object_pairs_hook=unique_json_object))
    return candidate


@dataclass(frozen=True, slots=True)
class InferenceFailure:
    reason: str


@dataclass(frozen=True, slots=True)
class InferenceText:
    text: str


def finance_inference_wording(
    evidence: EvidenceInput, result: InferenceText | InferenceFailure, model: str,
) -> Wording:
    match result:
        case InferenceFailure(reason=reason):
            return selected_finance_wording(None, model, reason)
        case InferenceText(text=text):
            try:
                raw = structured_json(text)
            except (ValueError, RecursionError):
                return selected_finance_wording(None, model)
            return selected_finance_wording(raw, model, evidence=evidence)
        case unreachable:
            assert_never(unreachable)


def chart_inference_wording(
    evidence: EvidenceInput, result: InferenceText | InferenceFailure, model: str
) -> Wording:
    match result:
        case InferenceFailure(reason=reason):
            return selected_chart_wording(evidence, None, model, reason)
        case InferenceText(text=text):
            try:
                raw = structured_json(text)
            except (ValueError, RecursionError):
                return selected_chart_wording(evidence, None, model, "invalid_chart_fact_selection")
            return selected_chart_wording(evidence, raw, model)
        case unreachable:
            assert_never(unreachable)


def request_timeout(config: ModelConfig) -> httpx2.Timeout:
    return httpx2.Timeout(
        connect=config.connect_timeout_seconds,
        read=config.read_timeout_seconds,
        write=config.write_timeout_seconds,
        pool=config.pool_timeout_seconds,
    )


def create_http_client(config: ModelConfig) -> httpx2.AsyncClient:
    """Return a reusable caller-owned client; use it as an async context manager."""
    transport = httpx2.AsyncHTTPTransport(
        http2=True,
        retries=0,
        trust_env=False,
        limits=_LIMITS,
        socket_options=[(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)],
    )
    return httpx2.AsyncClient(
        transport=transport, timeout=request_timeout(config), follow_redirects=False, trust_env=False
    )


def transport_failure(error: httpx2.RequestError) -> InferenceFailure:
    match error:
        case httpx2.PoolTimeout():
            reason = "pool_timeout"
        case httpx2.ConnectTimeout():
            reason = "connect_timeout"
        case httpx2.ReadTimeout():
            reason = "read_timeout"
        case httpx2.WriteTimeout():
            reason = "write_timeout"
        case httpx2.TimeoutException():
            reason = "http_timeout"
        case httpx2.DecodingError():
            reason = "response_decoding_error"
        case httpx2.TransportError():
            reason = "transport_error"
        case httpx2.RequestError():
            reason = "request_error"
        case _ as unreachable:
            assert_never(unreachable)
    return InferenceFailure(reason)


class OpenAICompatibleCoachModel:
    """Supplementary wording, typed judgment and mode routing over one pinned model endpoint."""

    def __init__(self, config: ModelConfig, *, client: httpx2.AsyncClient | None = None) -> None:
        self._config: ModelConfig = config
        self._client: httpx2.AsyncClient | None = client
        self._limiter: anyio.CapacityLimiter = anyio.CapacityLimiter(config.max_concurrency)

    async def write(self, evidence: EvidenceInput) -> Wording:
        """차트는 주어진 근거 ID만 선택하고 일반 코칭은 제한된 보조 문장을 검증한다.

        모델 오류·형식 위반은 원인이 기록된 정형 문구로 전환한다. 이 성공 여부와
        FDT의 수치 정확성은 별개이며 LLM 출력으로 금융 수치를 덮어쓰지 않는다.
        """
        result = await self._infer(evidence, "write")
        match evidence.purpose:
            case "finance":
                return finance_inference_wording(evidence, result, self._config.model)
            case "chart":
                return chart_inference_wording(evidence, result, self._config.model)
            case "coaching":
                pass
            case unreachable:
                assert_never(unreachable)
        match result:
            case InferenceFailure(reason=reason):
                return self._fallback(reason)
            case InferenceText(text=text):
                problem = wording_problem(text)
                if problem:
                    return self._fallback(problem)
                return Wording(text=text.strip(), source="llm", model=self._config.model)
            case _ as unreachable:
                assert_never(unreachable)

    async def judge(self, evidence: EvidenceInput) -> Judgment:
        result = await self._infer(evidence, "judge")
        match result:
            case InferenceFailure(reason=reason):
                return Judgment(
                    decision="needs_data",
                    reason_code="insufficient_context",
                    confidence=0.0,
                    source="template",
                    fallback_reason=reason,
                )
            case InferenceText(text=text):
                try:
                    parsed = JudgmentDraft.model_validate_json(structured_json(text))
                except (ValueError, RecursionError):
                    return Judgment(
                        decision="needs_data",
                        reason_code="insufficient_context",
                        confidence=0.0,
                        source="template",
                        fallback_reason="invalid_schema",
                    )
                return Judgment(
                    decision=parsed.decision,
                    reason_code=parsed.reason_code,
                    confidence=parsed.confidence,
                    source="llm",
                )
            case _ as unreachable:
                assert_never(unreachable)

    async def route(self, evidence: EvidenceInput) -> Routing:
        result = await self._infer(evidence, "route")
        match result:
            case InferenceFailure(reason=reason):
                return Routing(mode="review", source="template", fallback_reason=reason)
            case InferenceText(text=text):
                try:
                    parsed = RoutingDraft.model_validate_json(structured_json(text))
                except (ValueError, RecursionError):
                    return Routing(mode="review", source="template", fallback_reason="invalid_schema")
                return Routing(mode=parsed.mode, source="llm")
            case _ as unreachable:
                assert_never(unreachable)

    def _fallback(self, reason: str) -> Wording:
        return Wording(
            text=TEMPLATE_TEXT,
            source="template",
            fallback_reason=reason,
            model=self._config.model,
        )

    def _request(self, evidence: EvidenceInput, operation: Operation) -> httpx2.Request:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self._config.token is not None:
            headers["Authorization"] = f"Bearer {self._config.token.get_secret_value()}"
        payload: dict[str, JsonValue] = {
            "model": self._config.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt(
                        operation, chart=evidence.purpose == "chart", finance=evidence.purpose == "finance"
                    ),
                },
                {"role": "user", "content": user_payload(evidence)},
            ],
            "temperature": 0,
            "max_tokens": self._config.max_tokens,
            "stream": False,
        }
        match operation:
            case "write":
                if evidence.purpose == "finance":
                    payload["response_format"] = {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "finance_facts",
                            "strict": True,
                            "schema": FinanceSelection.model_json_schema(),
                        },
                    }
                if evidence.purpose == "chart":
                    payload["response_format"] = {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "chart_facts",
                            "strict": True,
                            "schema": ChartSelection.model_json_schema(),
                        },
                    }
            case "judge" | "route":
                schema: type[BaseModel] = JudgmentDraft if operation == "judge" else RoutingDraft
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": operation,
                        "strict": True,
                        "schema": schema.model_json_schema(),
                    },
                }
            case _ as unreachable:
                assert_never(unreachable)
        # A fresh Request avoids copying unrelated client authorization, cookies, or base URL.
        return httpx2.Request(
            "POST",
            self._config.endpoint_url or "",
            headers=headers,
            json=payload,
            extensions={"timeout": request_timeout(self._config).as_dict()},
        )

    async def _infer(self, evidence: EvidenceInput, operation: Operation) -> InferenceText | InferenceFailure:
        if self._config.endpoint_url is None:
            return InferenceFailure("disabled")
        if self._client is None or self._client.is_closed:
            return InferenceFailure("client_unavailable" if self._client is None else "client_closed")
        evidence = operation_evidence(evidence, operation)
        if context_limited(evidence):
            return InferenceFailure("context_limit")
        try:
            with anyio.fail_after(self._config.timeout_seconds):
                async with self._limiter:
                    return await self._send(self._client, self._request(evidence, operation))
        except TimeoutError:
            return InferenceFailure("deadline_exceeded")
        except httpx2.RequestError as error:
            return transport_failure(error)

    async def _send(
        self,
        client: httpx2.AsyncClient,
        request: httpx2.Request,
    ) -> InferenceText | InferenceFailure:
        if self._config.token_preflight:
            budget = await check_token_budget(client, request, self._config.max_tokens)
            if isinstance(budget, BudgetFailure):
                return InferenceFailure(budget.reason)
            request.headers["X-Coaching-Prompt-Sha256"] = budget.prompt_sha256
        response = await client.send(request, stream=True, auth=None, follow_redirects=False)
        try:
            return await self._read(response)
        finally:
            with anyio.move_on_after(0.1, shield=True):
                await response.aclose()

    async def _read(self, response: httpx2.Response) -> InferenceText | InferenceFailure:
        if response.status_code != 200:
            return InferenceFailure(f"http_status_{response.status_code}")
        body = bytearray()
        async for chunk in response.aiter_bytes():
            if len(body) + len(chunk) > self._config.max_response_bytes:
                return InferenceFailure("response_too_large")
            body.extend(chunk)
        try:
            _ = cast("object", json.loads(body, object_pairs_hook=unique_json_object))
            completion = CompletionEnvelope.model_validate_json(body)
        except (ValueError, RecursionError):
            return InferenceFailure("invalid_response")
        return InferenceText(completion.choices[0].message.content)
