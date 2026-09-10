"""Render amounts and causal claims only from the immutable decision receipt."""

from datetime import date

from coaching_service.periods import period_text
from coaching_service.schemas import JsonDocument, Receipt


def authoritative_text(receipt: Receipt) -> str:
    pieces = historical_text(receipt)
    if receipt.period is not None:
        pieces.append(period_text(receipt.period, date.fromisoformat(receipt.identity.as_of)))
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
    action = receipt.result.root.get("next_action")
    if isinstance(action, dict):
        title, detail = action.get("title"), action.get("detail")
        if isinstance(title, str) and isinstance(detail, str):
            pieces.append(title + ". " + detail)
    pieces.extend(user_warnings(receipt.result))
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
