"""Owner-bound sessions with engine tools and durable, idempotent turns."""

import time
from datetime import date, datetime
from typing import assert_never
from uuid import uuid4
from zoneinfo import ZoneInfo

import anyio

from coaching_service.chat_answers import (
    ChatAnswer,
    FinanceQuestion,
    knowledge_answer,
    missing_twin_answer,
    out_of_scope_answer,
)
from coaching_service.coaching import CoachingCore, coaching_writes, evidence_for
from coaching_service.errors import ServiceError
from coaching_service.evidence import bounded_evidence, context_limited
from coaching_service.finance_knowledge import finance_evidence
from coaching_service.history import historical_context
from coaching_service.knowledge_retrieval import is_followup
from coaching_service.llm_contract import ChatMessage, EvidenceInput, Routing
from coaching_service.payments import Ledger
from coaching_service.period_request import turn_period
from coaching_service.personal_service import personal_answer
from coaching_service.repository import Mutation, document, write
from coaching_service.schemas import (
    Coaching,
    JsonDocument,
    Message,
    ReviewRequest,
    Session,
    SessionRequest,
    TurnRequest,
)
from coaching_service.spending_history import spending_answer
from coaching_service.store import Operation


def chat_history(session: Session, *, include_subject: bool = False) -> tuple[ChatMessage, ...]:
    """Use recent context for intent; keep every original message intact in storage."""
    messages = session.messages[-4:]
    if include_subject:
        # Preserve one explicit topic through repeated short follow-ups without resending the full session.
        subject = next((
            row for row in reversed(session.messages) if row.role == "user" and not is_followup(row.content)
        ), None)
        if subject is not None and subject not in messages:
            messages = (subject, *messages[-2:])
    return tuple(
        ChatMessage(
            role=row.role, content=row.content[:800] + (" [이력 일부 생략]" if len(row.content) > 800 else "")
        )
        for row in messages
    )


def save_turn(session: Session, question: str, answer: Coaching | ChatAnswer) -> Mutation:
    """Commit the delivered answer and session text together, including retries."""
    updated = session.model_copy(
        update={
            "messages": (
                *session.messages,
                Message(role="user", content=question),
                Message(role="assistant", content=answer.text),
            )
        }
    )
    match answer:
        case Coaching():
            answer_writes = coaching_writes(answer, notify=False)
        case ChatAnswer():
            answer_writes = (write("answer/" + answer.id, answer),)
        case unreachable:
            assert_never(unreachable)
    return Mutation(result=document(answer), writes=(write("session/" + session.id, updated), *answer_writes))


class Dialogue:
    def __init__(self, core: CoachingCore) -> None:
        self.core: CoachingCore = core

    async def review(self, op: Operation, request: ReviewRequest) -> JsonDocument:
        async def action() -> Mutation:
            receipt = await self.core.receipt(await self.core.twin(op.owner), request)
            coaching = await self.core.compose(receipt, evidence_for(receipt))
            return Mutation(result=document(coaching), writes=coaching_writes(coaching, notify=False))

        return await self.core.repository.mutate(op, action)

    async def session(self, op: Operation, request: SessionRequest) -> JsonDocument:
        async def action() -> Mutation:
            if request.coaching_id is not None:
                _ = await self.core.repository.load(op.owner, "coaching/" + request.coaching_id)
            now = time.time()
            session = Session(
                id=uuid4().hex, coaching_id=request.coaching_id, created_at=now, expires_at=now + 86400
            )
            return Mutation(result=document(session), writes=(write("session/" + session.id, session),))

        return await self.core.repository.mutate(op, action)

    async def finance(self, op: Operation, request: FinanceQuestion) -> JsonDocument:
        """Allow a source-backed concept question without a Twin or initial review."""

        async def action() -> Mutation:
            answer = knowledge_answer(await self.core.model.write(finance_evidence(request.question)))
            return Mutation(result=document(answer), writes=(write("answer/" + answer.id, answer),))

        return await self.core.repository.mutate(op, action)

    async def standalone_answer(
        self, owner: str, request: TurnRequest, route: Routing, history: tuple[ChatMessage, ...]
    ) -> ChatAnswer | None:
        """Answer concepts before loading financial data; explicit analysis takes precedence."""
        if request.analysis is not None:
            return None
        if route.mode in {"finance", "history", "personal", "other"} and request.period is not None:
            # The period object specifies a future interval, never a historical filter.
            raise ServiceError("period_not_supported_for_intent", 422)
        match route.mode:
            case "finance":
                return knowledge_answer(
                    await self.core.model.write(finance_evidence(request.question, history))
                )
            case "other":
                return out_of_scope_answer()
            case "personal":
                return await personal_answer(self.core.repository, owner, request.question)
            case "history" | "review" | "risk" | "forecast":
                return None
            case unreachable:
                assert_never(unreachable)

    async def active_session(self, owner: str, session_id: str) -> Session:
        session = Session.model_validate_json(await self.core.repository.load(owner, "session/" + session_id))
        if session.expires_at <= time.time():
            raise ServiceError("session_expired", 410)
        if len(session.messages) >= 40:
            raise ServiceError("session_turn_limit", 409)
        return session

    async def turn(self, op: Operation, session_id: str, request: TurnRequest) -> JsonDocument:
        async def action() -> Mutation:
            session = await self.active_session(op.owner, session_id)
            history = chat_history(session)
            # Intent comes before calendar parsing: a deposit's maturity is not a forecast period.
            route = await self.core.model.route(
                EvidenceInput(
                    question=request.question, history=history, facts_json='{"operation":"dialogue"}'
                )
            )
            standalone = await self.standalone_answer(
                op.owner, request, route,
                chat_history(session, include_subject=True) if route.mode == "finance" else history,
            )
            if standalone is not None:
                # Keep actual router adoption separate from answer generation and HTTP success.
                standalone = standalone.model_copy(update={
                    "evidence": JsonDocument({**standalone.evidence.root, "routing": document(route).root})
                })
                return save_turn(session, request.question, standalone)
            try:
                twin = await self.core.twin(op.owner)
            except ServiceError as error:
                if error.code != "resource_not_found":
                    raise
                return save_turn(session, request.question, missing_twin_answer(route))
            identity = await anyio.to_thread.run_sync(self.core.engine.identity, twin)
            reference = date.fromisoformat(identity.as_of)
            if route.mode == "history" and request.analysis is None:
                summary = spending_answer(
                    reference,
                    await anyio.to_thread.run_sync(self.core.engine.transactions, twin),
                    request.question,
                )
                answer = ChatAnswer(
                    id=uuid4().hex,
                    answer_type="spending_history",
                    status=summary.status,
                    text=summary.text,
                    wording_source="engine",
                    model="not_called",
                    evidence=JsonDocument(
                        {
                            "identity": document(identity).root,
                            "routing": document(route).root,
                            "spending": summary.model_dump(mode="json"),
                        }
                    ),
                    created_at=time.time(),
                )
                return save_turn(session, request.question, answer)
            original = (
                None
                if session.coaching_id is None
                else Coaching.model_validate_json(
                    await self.core.repository.load(op.owner, "coaching/" + session.coaching_id)
                )
            )
            period = turn_period(reference, request.question, request.period, request.analysis)
            today = datetime.now(ZoneInfo("Asia/Seoul")).date()
            receipt = await self.core.receipt(
                twin,
                ReviewRequest(on_date=reference, through_date=period.forecast_end, replay=reference != today),
            )
            receipt = receipt.model_copy(
                update={
                    "original_coaching_id": original.id if original is not None else None,
                    "historical": historical_context(
                        original, await anyio.to_thread.run_sync(self.core.engine.transactions, twin)
                    )
                    if original is not None
                    else None,
                    "current_envelopes": Ledger.model_validate_json(
                        await self.core.repository.load(op.owner, "ledger")
                    ).envelopes,
                    "trigger": "dialogue",
                    "period": period,
                }
            )
            if context_limited(bounded_evidence(receipt, request.question, history)):
                # An intent-only route is not permission to analyze incomplete financial evidence.
                route = Routing(mode="review", source="template", fallback_reason="context_limit")
            receipt = receipt.model_copy(update={"routing": document(route)})
            numeric_request = request.analysis
            if numeric_request is None and route.mode in {"risk", "forecast"}:
                numeric_request = JsonDocument.model_validate(
                    {"mode": route.mode, "horizon_days": period.forecast_days, "paths": 100, "seed": 42}
                )
            if numeric_request is not None:
                numeric_request = JsonDocument({**numeric_request.root, "horizon_days": period.forecast_days})
                numeric_result = await anyio.to_thread.run_sync(
                    self.core.engine.numeric, twin, numeric_request, limiter=self.core.engine_limit
                )
                receipt = receipt.model_copy(
                    update={"numeric_request": numeric_request, "numeric_result": numeric_result}
                )
            evidence = bounded_evidence(receipt, request.question, history)
            coaching = await self.core.compose(receipt, evidence)
            return save_turn(session, request.question, coaching)

        return await self.core.repository.mutate(op, action)
