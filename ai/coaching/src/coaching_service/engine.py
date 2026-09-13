"""Direct calls to the unmodified 307de59 team engine."""

from fdt import Engine, Twin
from fdt.coaching import Coach
from fdt.ingest import Transaction, normalize
from fdt.store import apply_events
from pydantic import ValidationError

from coaching_service.admission import admit
from coaching_service.chart_contract import DailyForecast
from coaching_service.chart_engine import ChartEngine
from coaching_service.errors import ServiceError
from coaching_service.provenance import ENGINE_COMMIT
from coaching_service.schemas import Bootstrap, JsonDocument, TransactionView, TwinIdentity

__all__ = ("ENGINE_COMMIT", "EngineAdapter")


def normalized_transaction(document: JsonDocument) -> Transaction:
    """팀 엔진의 정규화를 유지하되 입금을 소비로 세는 모순된 입력은 거부한다."""
    transaction = normalize(document.root)
    # 고정된 FDT 설계에서 TRANSFER_IN은 입금이다. 누락·INCOME·TRANSFER의 기존
    # 해석은 유지하고, EXPENSE로 동시에 지정한 경우만 저장 전에 422로 돌려준다.
    if (
        transaction.raw.get("transaction_type") == "TRANSFER_IN"
        and transaction.raw.get("direction") == "EXPENSE"
    ):
        raise ServiceError("inconsistent_transfer_direction")
    return transaction


class EngineAdapter:
    """원 단위 금융 계산을 고정된 FDT에 위임하는 서비스 경계.

    거래 정규화·소유자·계산 자원은 여기서 검증하고, FDT 결과 문서를 보존한다.
    LLM 문구나 화면 표시를 근거로 엔진 금액을 덮어쓰지 않는다.
    """

    def create(self, request: Bootstrap, owner: str) -> JsonDocument:
        twin = Twin(
            [normalized_transaction(row) for row in request.transactions],
            request.as_of.isoformat(),
            snapshot=request.snapshot.root if request.snapshot else None,
        )
        if twin.user_id != owner or any(row.user_id != owner for row in twin.transactions):
            raise ServiceError("user_mismatch", 403)
        return JsonDocument.model_validate(twin.to_dict())

    def update(
        self, document: JsonDocument, event: JsonDocument, snapshot_event: JsonDocument | None = None
    ) -> JsonDocument:
        if event.root.get("type") == "transaction":
            raw = event.root.get("transaction")
            if isinstance(raw, dict):
                _ = normalized_transaction(JsonDocument(raw))
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
        """한 번의 예측에서 누적 P50 결과와 같은 경로의 일별 평균을 함께 얻는다.

        잘못된 사용자 요청은 422, 엔진의 일별 결과 누락은 계약 위반인 502다.
        일별 막대를 만들기 위해 다른 난수 경로로 예측을 다시 실행하지 않는다.
        """
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
