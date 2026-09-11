"""Direct calls to the unmodified 307de59 team engine."""

from fdt import Engine, Twin
from fdt.coaching import Coach
from fdt.ingest import normalize
from fdt.store import apply_events
from pydantic import ValidationError

from coaching_service.admission import admit
from coaching_service.chart_contract import DailyForecast
from coaching_service.chart_engine import ChartEngine
from coaching_service.errors import ServiceError
from coaching_service.provenance import ENGINE_COMMIT
from coaching_service.schemas import Bootstrap, JsonDocument, TransactionView, TwinIdentity

__all__ = ("ENGINE_COMMIT", "EngineAdapter")


class EngineAdapter:
    def create(self, request: Bootstrap, owner: str) -> JsonDocument:
        twin = Twin(
            [normalize(row.root) for row in request.transactions],
            request.as_of.isoformat(),
            snapshot=request.snapshot.root if request.snapshot else None,
        )
        if twin.user_id != owner or any(row.user_id != owner for row in twin.transactions):
            raise ServiceError("user_mismatch", 403)
        return JsonDocument.model_validate(twin.to_dict())

    def update(
        self, document: JsonDocument, event: JsonDocument, snapshot_event: JsonDocument | None = None
    ) -> JsonDocument:
        events = [event.root]
        if snapshot_event is not None:
            if snapshot_event.root.get("type") != "snapshot":
                raise ServiceError("companion_event_must_be_snapshot")
            events.append(snapshot_event.root)
        return JsonDocument.model_validate(apply_events(Twin.from_dict(document.root), events).to_dict())

    def identity(self, document: JsonDocument) -> TwinIdentity:
        twin = Twin.from_dict(document.root)
        return TwinIdentity(
            user_id=twin.user_id,
            twin_id=twin.twin_id,
            revision=twin.revision,
            input_digest=twin.content_digest,
            as_of=twin.as_of,
        )

    def transactions(self, document: JsonDocument) -> tuple[TransactionView, ...]:
        return tuple(
            TransactionView(
                id=row.id,
                source=row.source,
                date=row.date,
                time=row.time,
                envelope=row.envelope,
                amount_krw=row.amount_krw,
                budget_amount_krw=row.budget_amount_krw,
                kind=row.kind,
                active=row.active,
                pending=row.pending,
            )
            for row in Twin.from_dict(document.root).transactions
        )

    def observation_audit(self, document: JsonDocument) -> JsonDocument:
        return JsonDocument.model_validate(Twin.from_dict(document.root).model["audit"])

    def review(self, document: JsonDocument, request: JsonDocument) -> JsonDocument:
        return JsonDocument.model_validate(Coach(Twin.from_dict(document.root)).review(request.root))

    def numeric(self, document: JsonDocument, request: JsonDocument) -> JsonDocument:
        try:
            admit(request)
        except ValidationError:
            raise ServiceError("invalid_numeric_request") from None
        return JsonDocument.model_validate(Engine(Twin.from_dict(document.root)).run(request.root))

    def chart_numeric(
        self, document: JsonDocument, request: JsonDocument
    ) -> tuple[JsonDocument, DailyForecast]:
        try:
            admit(request)
        except ValidationError:
            raise ServiceError("invalid_numeric_request") from None
        if request.root.get("mode") != "forecast":
            raise ServiceError("chart_requires_forecast")
        engine = ChartEngine(Twin.from_dict(document.root))
        numeric = JsonDocument.model_validate(engine.run(request.root))
        if engine.daily is None:
            raise ServiceError("chart_daily_forecast_missing", 502)
        return numeric, engine.daily
