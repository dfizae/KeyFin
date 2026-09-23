# ruff: noqa: INP001
"""Future-tense buy phrasings are purchases, so their date words never trigger a period re-ask.

"내일 … 사려는데" used to miss the purchase verbs, fall through to the period parser, and get
"언제 기준인지 알려주세요" even though "내일" already named the date.
"""

import pytest

from coaching_service.fast_routes import NaturalPurchase, natural_purchase


@pytest.mark.parametrize(
    "question",
    [
        "나 내일 70만원 닌텐도 스위치 현금으로 사려는데 괜찮을까? 차트도 보여줘",
        "내일 70만원 스위치 현금으로 사려해",
        "내일 스위치 70만원짜리 현금으로 살건데 괜찮아?",
        "내일 70만원 스위치 현금으로 살거야",
        "내일 70만원 스위치 현금으로 구매하려는데 괜찮아?",
        "내일 70만원 스위치 현금으로 구입하려고 해",
    ],
)
def test_future_tense_purchase_is_admitted(question: str) -> None:
    parsed = natural_purchase(question)
    assert isinstance(parsed, NaturalPurchase), parsed
    assert (parsed.amount_krw, parsed.date_token, parsed.payment_hint) == (700_000, "tomorrow", "cash")


@pytest.mark.parametrize(
    "question",
    [
        "서울에 살건데 집값 어때",  # 살다(live), no amount or item
        "나중에 어디서 살 생각이야?",
    ],
)
def test_living_phrases_stay_out_of_purchase(question: str) -> None:
    assert natural_purchase(question) is None
