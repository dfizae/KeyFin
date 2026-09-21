"""Render amounts and causal claims only from the immutable decision receipt."""

from datetime import date
from typing import Final

from coaching_service.numeric_rendering import numeric_text, purchase_verdict_text
from coaching_service.periods import period_text
from coaching_service.schemas import JsonDocument, Receipt, Tone


def authoritative_text(receipt: Receipt) -> str:
    pieces = historical_text(receipt)
    if receipt.period is not None:
        pieces.append(period_text(receipt.period, date.fromisoformat(receipt.identity.as_of)))
    pieces.extend(numeric_text(receipt))
    facts = receipt.payment
    if facts is not None:
        pieces.append(
            f"{facts.envelope} 결제액 {facts.amount_krw:,}원, "
            f"차감 전 봉투 잔액 {facts.balance_before_krw:,}원, "
            f"차감 후 {facts.balance_after_krw:,}원입니다."
        )
        if facts.remaining_percent is not None:
            pieces.append(
                f"직전 잔액 대비 남은 비율은 {facts.remaining_percent}%, "
                f"해당 주 같은 봉투의 확인된 결제는 {facts.weekly_count}회입니다."
            )
        if receipt.trigger == "p0_half_balance":
            pieces.append("결제액이 차감 전 봉투 잔액의 50% 이상이어서 코칭이 생성됐습니다.")
        elif receipt.trigger == "p1_context_concern":
            pieces.append("애매 상황에 대한 모델의 보조 판단으로 추가 점검을 제안합니다.")
    # A session-bound historical follow-up must never label the old FDT result as
    # a new result for the current Twin revision. It still renders the preserved
    # historical cause so the user can see why the original coaching existed.
    result = (
        receipt.historical.engine_result
        if receipt.trigger == "historical_coaching_followup" and receipt.historical is not None
        else receipt.result
    )
    action = result.root.get("next_action")
    if isinstance(action, dict):
        title, detail = action.get("title"), action.get("detail")
        if isinstance(title, str) and isinstance(detail, str):
            pieces.append(title + ". " + detail)
    pieces.extend(user_warnings(result))
    if not pieces:
        pieces.append("현재 자료로 확인할 수 있는 코칭 근거가 부족합니다. 거래·잔액 정보를 확인해 주세요.")
    return "\n".join(pieces)


def historical_text(receipt: Receipt) -> list[str]:
    pieces: list[str] = []
    past = receipt.historical
    if past is not None and past.payment is not None:
        facts = past.payment
        pieces.append(
            f"이전 코칭 생성 당시의 기록: 결제액 {facts.amount_krw:,}원, "
            f"당시 차감 전 {facts.balance_before_krw:,}원, "
            f"당시 차감 후 {facts.balance_after_krw:,}원이었습니다."
        )
        if past.transaction_status == "canceled":
            pieces.append(
                "그 코칭의 원 거래는 현재 취소 상태입니다. 당시 잔액을 현재 잔액으로 사용하지 않습니다."
            )
        elif past.transaction_status == "not_found":
            pieces.append("현재 자료에서 원 거래를 찾을 수 없어 거래 상태를 확인할 수 없습니다.")
    pieces.extend(
        f"현재 수신 이벤트까지 반영한 {envelope.envelope} 봉투 장부 잔액은 {envelope.balance_krw:,}원입니다."
        for envelope in receipt.current_envelopes
    )
    return pieces


_OVER_BUDGET_ENCOURAGING: Final = (
    "{env} 지출이 예산을 넘고 있어요. 이번 기간 {env} 소비를 조금 줄여보면 좋아요."
)
_OVER_BUDGET_DIRECT: Final = "{env} 예산을 초과했어요. {env} 소비를 줄이세요."
_NEAR_LIMIT_ENCOURAGING: Final = "{env} 예산이 거의 다 찼어요. 남은 기간 지출을 조절해 보세요."
_NEAR_LIMIT_DIRECT: Final = "{env} 예산이 얼마 남지 않았어요. {env} 지출을 줄이세요."
_SHORTFALL_ENCOURAGING: Final = "이번 기간 현금이 부족할 수 있어요. 큰 지출은 미루는 편이 좋아요."
_SHORTFALL_DIRECT: Final = "이번 기간 현금이 부족할 수 있어요. 큰 지출은 미루세요."
_SHORTFALL_MARKER: Final = "부족 예측 있음."
_NEAR_LIMIT_MAX_PERCENT: Final = 10
_HEALTHY_ENCOURAGING: Final = (
    "{env} 예산에 여유가 있어요. 남는 만큼은 저축이나 비상금으로 옮겨 두면 좋아요."
)
_HEALTHY_DIRECT: Final = "{env} 예산에 여유가 있어요. 남는 만큼은 저축으로 옮겨 두세요."
_HEALTHY_MIN_PERCENT: Final = 80
_OBSERVED_BUDGET_BASIS: Final = "approved_snapshot_budget_minus_observed_budgeted_spending"


def _observed_budget_bands(receipt: Receipt) -> tuple[tuple[str, float], ...]:
    """Read the review engine's own per-envelope remaining fact as ``(envelope, remaining_percent)``.

    A ``requested_review`` receipt never carries ``PaymentFacts``, so its
    ``deterministic_advice`` had no ``remaining_percent`` signal at all. The
    pinned review result (``vendor/fdt/coaching.py`` ``observed_budgets``) already
    computes each envelope's ``budget_krw`` and ``observed_remaining_krw`` from the
    approved snapshot budget minus observed budgeted spending, bound to the same
    Twin revision as the rest of the receipt. This helper only reads that existing
    fact and converts it to a percentage for the identical bands the payment path
    uses; it invents no number and returns ``()`` whenever the fact is absent,
    malformed, or explicitly flagged unreliable.

    It is deliberately confined to receipts without ``PaymentFacts`` so a
    payment-event receipt keeps its established single-envelope advice unchanged.
    """
    if receipt.payment is not None:
        return ()
    result = receipt.result.root
    # Only a fully ready review is trustworthy. A ``needs_data`` review (stale or
    # dirty snapshot, missing cash inputs) still lists observed budgets, but the
    # engine is asking for a data refresh first, so its remaining is not a basis
    # for a spending nudge. Treat anything but ``ready`` as an absent fact.
    if result.get("status") != "ready":
        return ()
    warnings = result.get("warnings")
    if isinstance(warnings, list) and any(
        # The engine itself says remaining budget is not trustworthy for advice
        # when its input is incomplete; treat that as an absent fact, not a nudge.
        isinstance(warning, dict) and warning.get("code") == "BUDGET_INPUT_INCOMPLETE"
        for warning in warnings
    ):
        return ()
    rows = result.get("observed_budgets")
    if not isinstance(rows, list):
        return ()
    bands: list[tuple[str, float]] = []
    for row in rows:
        if not isinstance(row, dict):
            return ()
        if row.get("basis") != _OBSERVED_BUDGET_BASIS:
            continue
        envelope = row.get("envelope")
        budget = row.get("budget_krw")
        remaining = row.get("observed_remaining_krw")
        if (
            not isinstance(envelope, str)
            or not envelope
            or isinstance(budget, bool)
            or not isinstance(budget, (int, float))
            or isinstance(remaining, bool)
            or not isinstance(remaining, (int, float))
            or budget <= 0
        ):
            continue
        bands.append((envelope, remaining / budget * 100))
    return tuple(bands)


def _over_budget_envelope(receipt: Receipt) -> str | None:
    """Name one envelope already confirmed over budget by the engine's own facts.

    ``remaining_percent`` is the service-computed payment ledger fact
    (``PaymentFacts``); a value at or below zero means this payment already
    consumed the envelope. ``current_envelopes`` is the separately maintained
    ledger balance. Neither path invents a new threshold: both simply read an
    existing signal that the engine already produced.
    """
    payment = receipt.payment
    if payment is not None and payment.remaining_percent is not None:
        try:
            remaining = float(payment.remaining_percent)
        except ValueError:
            remaining = None
        if remaining is not None and remaining <= 0:
            return payment.envelope
    for envelope in receipt.current_envelopes:
        if envelope.balance_krw < 0:
            return envelope.envelope
    for name, remaining_percent in _observed_budget_bands(receipt):
        if remaining_percent <= 0:
            return name
    return None


def _near_limit_envelope(receipt: Receipt) -> str | None:
    """Name an envelope that is not over budget yet but is nearly exhausted.

    Reads the same already-validated ``remaining_percent`` payment fact as
    ``_over_budget_envelope`` and fires only in the strictly-between band
    ``0 < remaining_percent <= 10``. A value outside that band, missing, or
    unparseable returns ``None`` instead of guessing. On a review receipt with no
    payment fact, the same band is read from the engine's own observed-budget
    remaining instead.
    """
    payment = receipt.payment
    if payment is not None:
        if payment.remaining_percent is None:
            return None
        try:
            remaining = float(payment.remaining_percent)
        except ValueError:
            return None
        return payment.envelope if 0 < remaining <= _NEAR_LIMIT_MAX_PERCENT else None
    for name, remaining_percent in _observed_budget_bands(receipt):
        if 0 < remaining_percent <= _NEAR_LIMIT_MAX_PERCENT:
            return name
    return None


def _healthy_envelope(receipt: Receipt) -> str | None:
    """Name an envelope the engine already reports as comfortably in surplus.

    Reads the same already-validated ``remaining_percent`` payment fact as
    ``_near_limit_envelope`` and ``_over_budget_envelope`` and fires only when it
    sits at or above ``_HEALTHY_MIN_PERCENT``. This is the lowest-precedence
    signal: a value below that band, missing, or unparseable returns ``None`` so
    no maintenance nudge is invented for an account with no clear surplus. On a
    review receipt with no payment fact, the same surplus band is read from the
    engine's own observed-budget remaining instead.
    """
    payment = receipt.payment
    if payment is not None:
        if payment.remaining_percent is None:
            return None
        try:
            remaining = float(payment.remaining_percent)
        except ValueError:
            return None
        return payment.envelope if remaining >= _HEALTHY_MIN_PERCENT else None
    for name, remaining_percent in _observed_budget_bands(receipt):
        if remaining_percent >= _HEALTHY_MIN_PERCENT:
            return name
    return None


def deterministic_advice(receipt: Receipt, *, tone: Tone | None = None) -> str | None:
    """Return one server-templated advice sentence, or ``None`` when no engine concern fires.

    This never calls the language model and contains no digits of its own; every
    branch is gated on an existing, already-validated engine fact (an over-budget
    or near-limit envelope's name, or the same forecast-shortfall signal already
    rendered by ``purchase_verdict_text``). Precedence per envelope is
    over-budget > near-limit > shortfall > healthy-surplus: only the single most
    severe sentence is ever returned, never more than one stacked together. The
    lowest-precedence healthy branch fires only when the engine's own
    ``remaining_percent`` surplus fact is actually present and comfortably high;
    a missing signal returns ``None`` instead of nudging every healthy account.
    A ``requested_review`` receipt carries no ``PaymentFacts``, so its envelope
    bands are instead read from the review engine's own ``observed_budgets``
    remaining (``_observed_budget_bands``) with the identical thresholds; a
    payment-event receipt keeps its established single-envelope payment path.
    """
    envelope = _over_budget_envelope(receipt)
    if envelope is not None:
        template = _OVER_BUDGET_DIRECT if tone == "direct" else _OVER_BUDGET_ENCOURAGING
        return template.format(env=envelope)
    envelope = _near_limit_envelope(receipt)
    if envelope is not None:
        template = _NEAR_LIMIT_DIRECT if tone == "direct" else _NEAR_LIMIT_ENCOURAGING
        return template.format(env=envelope)
    if _SHORTFALL_MARKER in purchase_verdict_text(receipt):
        return _SHORTFALL_DIRECT if tone == "direct" else _SHORTFALL_ENCOURAGING
    envelope = _healthy_envelope(receipt)
    if envelope is not None:
        template = _HEALTHY_DIRECT if tone == "direct" else _HEALTHY_ENCOURAGING
        return template.format(env=envelope)
    return None


def user_warnings(result: JsonDocument) -> list[str]:
    pieces: list[str] = []
    warnings = result.root.get("warnings")
    if isinstance(warnings, list):
        for warning in warnings:
            if isinstance(warning, dict) and warning.get("severity") == "user":
                detail = warning.get("detail")
                if isinstance(detail, str):
                    pieces.append(detail)
    return pieces
