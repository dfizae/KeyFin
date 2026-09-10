"""Owner-bound sessions with engine tools and durable, idempotent turns."""

import time
from datetime import date, datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

import anyio

from coaching_service.coaching import CoachingCore, coaching_writes, evidence_for
from coaching_service.errors import ServiceError
from coaching_service.evidence import bounded_evidence, context_limited
from coaching_service.history import historical_context
from coaching_service.llm_contract import ChatMessage, Routing
from coaching_service.payments import Ledger
from coaching_service.period_request import turn_period
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
from coaching_service.store import Operation


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
            _ = await self.core.repository.load(op.owner, "coaching/" + request.coaching_id)
            now = time.time()
            session = Session(
                id=uuid4().hex, coaching_id=request.coaching_id, created_at=now, expires_at=now + 86400
            )
            return Mutation(result=document(session), writes=(write("session/" + session.id, session),))

        return await self.core.repository.mutate(op, action)

    async def turn(self, op: Operation, session_id: str, request: TurnRequest) -> JsonDocument:
        async def action() -> Mutation:
            session = Session.model_validate_json(
                await self.core.repository.load(op.owner, "session/" + session_id)
            )
            if session.expires_at <= time.time():
                raise ServiceError("session_expired", 410)
            if len(session.messages) >= 40:
                raise ServiceError("session_turn_limit", 409)
            original = Coaching.model_validate_json(
                await self.core.repository.load(op.owner, "coaching/" + session.coaching_id)
            )
            twin = await self.core.twin(op.owner)
            identity = await anyio.to_thread.run_sync(self.core.engine.identity, twin)
            reference = date.fromisoformat(identity.as_of)
            period = turn_period(reference, request.question, request.period, request.analysis)
            today = datetime.now(ZoneInfo("Asia/Seoul")).date()
            receipt = await self.core.receipt(
                twin,
                ReviewRequest(
                    on_date=reference, through_date=period.forecast_end, replay=reference != today
                ),
            )
            receipt = receipt.model_copy(
                update={
                    "original_coaching_id": original.id,
                    "historical": historical_context(
                        original, await anyio.to_thread.run_sync(self.core.engine.transactions, twin)
                    ),
                    "current_envelopes": Ledger.model_validate_json(
                        await self.core.repository.load(op.owner, "ledger")
                    ).envelopes,
                    "trigger": "dialogue",
                    "period": period,
                }
            )
            history = tuple(
                ChatMessage(
                    role=row.role,
                    content=(row.content[:2800] + " [긴 과거 메시지 생략]")
                    if len(row.content) > 2800
                    else row.content,
                )
                for row in session.messages[-12:]
            )
            evidence = bounded_evidence(receipt, request.question, history)
            route = (
                Routing(mode="review", source="template", fallback_reason="context_limit")
                if context_limited(evidence)
                else await self.core.model.route(evidence)
            )
            receipt = receipt.model_copy(update={"routing": document(route)})
            numeric_request = request.analysis
            if numeric_request is None and route.mode in {"risk", "forecast"}:
                numeric_request = JsonDocument.model_validate(
                    {"mode": route.mode, "horizon_days": period.forecast_days, "paths": 100, "seed": 42}
                )
            if numeric_request is not None:
                numeric_request = JsonDocument(
                    {**numeric_request.root, "horizon_days": period.forecast_days}
                )
                numeric_result = await anyio.to_thread.run_sync(
                    self.core.engine.numeric, twin, numeric_request, limiter=self.core.engine_limit
                )
                receipt = receipt.model_copy(
                    update={"numeric_request": numeric_request, "numeric_result": numeric_result}
                )
            evidence = bounded_evidence(receipt, request.question, history)
            coaching = await self.core.compose(receipt, evidence)
            updated = session.model_copy(
                update={
                    "messages": (
                        *session.messages,
                        Message(role="user", content=request.question),
                        Message(role="assistant", content=coaching.text),
                    )
                }
            )
            return Mutation(
                result=document(coaching),
                writes=(write("session/" + session.id, updated), *coaching_writes(coaching, notify=False)),
            )

        return await self.core.repository.mutate(op, action)
