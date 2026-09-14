"""Reusable orchestration of real engine evidence and model language."""

import time
from datetime import date, timedelta
from typing import Protocol
from uuid import uuid4

import anyio
from pydantic import ValidationError

from coaching_service.engine import ENGINE_COMMIT, EngineAdapter
from coaching_service.evidence import LIMITED_CONTEXT, bounded_evidence, context_limited
from coaching_service.llm_contract import EvidenceInput, Judgment, Routing, Wording
from coaching_service.llm_prompt import TEMPLATE_TEXT
from coaching_service.periods import ThroughDate, resolve_period
from coaching_service.rendering import authoritative_text
from coaching_service.repository import Repository, write
from coaching_service.schemas import (
    Coaching,
    JsonDocument,
    Notification,
    PaymentFacts,
    Receipt,
    ReviewRequest,
)
from coaching_service.store import Write


class LanguageModel(Protocol):
    async def write(self, evidence: EvidenceInput) -> Wording: ...
    async def judge(self, evidence: EvidenceInput) -> Judgment: ...
    async def route(self, evidence: EvidenceInput) -> Routing: ...


class CoachingCore:
    def __init__(self, repository: Repository, model: LanguageModel) -> None:
        self.repository: Repository = repository
        self.model: LanguageModel = model
        self.engine: EngineAdapter = EngineAdapter()
        self.engine_limit: anyio.CapacityLimiter = anyio.CapacityLimiter(4)

    async def twin(self, owner: str) -> JsonDocument:
        return JsonDocument.model_validate_json(await self.repository.load(owner, "twin"))

    async def receipt(self, twin: JsonDocument, request: ReviewRequest) -> Receipt:
        period = resolve_period(request.on_date, ThroughDate(end_date=request.through_date), "review")
        raw_request = JsonDocument.model_validate_json(request.model_dump_json(exclude_none=True))
        result = await anyio.to_thread.run_sync(
            self.engine.review, twin, raw_request, limiter=self.engine_limit
        )
        identity = await anyio.to_thread.run_sync(self.engine.identity, twin)
        return Receipt(
            engine_commit=ENGINE_COMMIT,
            identity=identity,
            request=raw_request,
            result=result,
            trigger="requested_review",
            period=period,
        )

    async def payment_receipt(self, twin: JsonDocument, facts: PaymentFacts | None) -> Receipt:
        identity = await anyio.to_thread.run_sync(self.engine.identity, twin)
        day = date.fromisoformat(identity.as_of)
        review = ReviewRequest(on_date=day, through_date=day + timedelta(days=7))
        receipt = await self.receipt(twin, review)
        return receipt.model_copy(update={"payment": facts})

    async def compose(self, receipt: Receipt, evidence: EvidenceInput) -> Coaching:
        """금액·날짜는 검증된 receipt로 작성하고 LLM은 보조 안내만 덧붙인다.

        근거가 한도를 넘거나 문장을 채택하지 못해도 금융 결과를 바꾸지 않는다.
        대체 문구의 출처·원인은 응답에 남겨 실제 모델 성공과 구분한다.
        """
        answer_text = authoritative_text(receipt)
        wording_input = supplementary_evidence(evidence, answer_text)
        wording = (
            Wording(
                text=TEMPLATE_TEXT, source="template", model="not_called", fallback_reason="context_limit"
            )
            if context_limited(wording_input)
            else await self.model.write(wording_input)
        )
        return Coaching(
            id=uuid4().hex,
            text=answer_text + "\n\n" + wording.text,
            wording_source=wording.source,
            model=wording.model,
            fallback_reason=wording.fallback_reason,
            receipt=receipt,
            created_at=time.time(),
        )


def coaching_writes(coaching: Coaching, *, notify: bool) -> tuple[Write, ...]:
    log = write("coaching/" + coaching.id, coaching)
    if not notify:
        return (log,)
    notification = Notification(
        event_id=uuid4().hex, coaching_id=coaching.id, text=coaching.text, created_at=coaching.created_at
    )
    return log, write("outbox/" + notification.event_id, notification)


def evidence_for(receipt: Receipt) -> EvidenceInput:
    return bounded_evidence(receipt)


def supplementary_evidence(evidence: EvidenceInput, answer_text: str) -> EvidenceInput:
    """Give the follow-up writer the exact displayed facts once, not both full analyses.

    Financial values have already passed the receipt renderer. The writer cannot
    recalculate them and needs only the displayed facts and recent conversation.
    The complete, immutable receipt is still returned and stored by compose().
    Tokenizer preflight remains mandatory: a character bound is not a token bound.
    """
    if context_limited(evidence):
        return evidence
    try:
        return EvidenceInput(
            question=evidence.question,
            history=evidence.history[-2:],
            facts_json=JsonDocument(
                {"basis": "displayed_receipt", "authoritative_answer": answer_text}
            ).model_dump_json(),
        )
    except ValidationError:
        return EvidenceInput(question=evidence.question, facts_json=LIMITED_CONTEXT)
