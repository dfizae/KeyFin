# ruff: noqa: INP001
"""Every question keeps its own intent inside one conversation (live report 2026-09-26).

In one live session a purchase answer was followed by "100만원 리조트 … 현금 결제해도
괜찮아?", "3만원짜리 책 살 건데 예산 괜찮아?", "지금 가장 금리가 높은 예금은?" and
"복리가 뭐야?", and all four came back as the same envelope-balance review. Three
defects combined: any session history switched the catalog shortcuts off so the router
decided (and answered "review"); the purchase grammar missed "결제해도", "책" and
"리조트"; and the purchase verdict only weighed the account, so a 300만원 laptop was
"예산 안에 들어와 괜찮아요" against 50,000원 left in 기타. The router here always
answers "review" (the live failure) so every assertion holds without it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import httpx2
import pytest
from test_api import TOKEN, setup
from test_balance_check_ledger_only import _BUDGETS, _overspent_twin
from test_multiturn_clarification_context import RouteTo

from coaching_service.dialogue import off_topic_route
from coaching_service.fast_routes import (
    balance_envelope,
    deterministic_analysis_route,
    deterministic_lookup_route,
    is_bare_purchase_fragment,
    natural_purchase,
    purchase_amounts,
    purchase_envelopes,
)
from coaching_service.finance_knowledge import deterministic_finance_status, finance_evidence
from coaching_service.numeric_rendering import purchase_verdict_text
from coaching_service.rendering import deterministic_advice
from coaching_service.schemas import Bootstrap, Envelope, JsonDocument, Receipt, TwinIdentity

if TYPE_CHECKING:
    from pathlib import Path


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class LiveRouter(RouteTo):
    """The deployed adapter keeps the catalog shortcuts on (ModelConfig default); the
    router itself answers "review" for everything, as it did live."""

    deterministic_finance_fast_path = True

    def __init__(self) -> None:
        super().__init__("review")


def _funded_twin() -> Bootstrap:
    """Seven envelopes each still holding its whole budget; two accounts, two cards."""
    return _overspent_twin().model_copy(
        update={
            "envelopes": tuple(
                Envelope(envelope=name, balance_krw=amount) for name, amount in _BUDGETS.items()
            )
        }
    )


_SCREENSHOT = (
    "300만원 노트북 이번 주에 현금으로 사면 괜찮아?",
    "100만원 리조트 이번 주에 현금 결제해도 괜찮아?",
    "3만원짜리 책 살 건데 예산 괜찮아?",
    "지금 가장 금리가 높은 예금은?",
    "복리가 뭐야?",
)


async def _conversation(
    tmp_path: Path, questions: tuple[str, ...], *, one_session: bool, router: LiveRouter,
) -> list[dict[str, Any]]:
    async with httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=setup(tmp_path / "intent.sqlite3", router)),
        base_url="http://t",
        headers={"Authorization": "Bearer " + TOKEN},
    ) as client:
        pushed = await client.post(
            "/v1/twin", json=_funded_twin().model_dump(mode="json"), headers={"Idempotency-Key": "t"}
        )
        assert pushed.status_code == 200, pushed.text
        session_id = ""
        answers = []
        for index, question in enumerate(questions):
            if index == 0 or not one_session:
                created = await client.post("/v1/sessions", json={}, headers={"Idempotency-Key": f"s{index}"})
                session_id = created.json()["id"]
            reply = await client.post(
                f"/v1/sessions/{session_id}/messages",
                json={"question": question},
                headers={"Idempotency-Key": f"q{index}"},
            )
            assert reply.status_code == 200, (question, reply.text)
            answers.append(reply.json())
        return answers


def _assert_screenshot_answers(answers: list[dict[str, Any]]) -> None:
    laptop, resort, book, rate, compound = answers
    assert laptop["receipt"]["request"]["changes"][0] | {"date": None} == {
        "kind": "expense", "date": None, "amount_krw": 3_000_000, "envelope": "기타", "account_id": "a",
    }
    assert laptop["text"].split("\n")[0] == (
        "계좌 잔액으로는 결제할 수 있지만 기타 봉투에 남은 50,000원보다 많아 "
        "봉투 예산을 2,950,000원 초과해요."
    )
    assert resort["receipt"]["request"]["changes"][0] | {"date": None} == {
        "kind": "expense", "date": None, "amount_krw": 1_000_000, "envelope": "취미·여가", "account_id": "a",
    }
    assert resort["text"].split("\n")[0] == (
        "계좌 잔액으로는 결제할 수 있지만 취미·여가 봉투에 남은 150,000원보다 많아 "
        "봉투 예산을 850,000원 초과해요."
    )
    for purchase in (laptop, resort):
        assert "봉투 잔액 합계" not in purchase["text"]
        assert "저축" not in purchase["text"]
        assert "봉투별 남은 잔액은 아래 표에 정리했어요." in purchase["text"]
    assert (book["answer_type"], book["status"], book["fallback_reason"]) == (
        "purchase_review", "needs_clarification", "purchase_date_required",
    )
    assert (rate["answer_type"], rate["status"]) == ("finance_education", "needs_source")
    assert (compound["answer_type"], compound["status"]) == ("finance_education", "answered")
    assert [row["id"] for row in compound["evidence"]["references"]] == ["compound_interest"]


@pytest.mark.anyio
@pytest.mark.parametrize("one_session", [True, False])
async def test_the_live_conversation_keeps_every_intent(tmp_path: Path, one_session: bool) -> None:
    router = LiveRouter()
    answers = await _conversation(tmp_path, _SCREENSHOT, one_session=one_session, router=router)
    _assert_screenshot_answers(answers)
    # None of the five needed the router, so its "review" answer never reached them.
    assert router.routes == 0


# --- amounts, items and verbs -----------------------------------------------------------


@pytest.mark.parametrize(("text", "amounts"), [
    ("30만원", (300_000,)), ("15,000원", (15_000,)), ("5천원", (5_000,)), ("2.5만원", (25_000,)),
    ("1만 5천원", (15_000,)), ("1만 5000원", (15_000,)), ("3만 원", (30_000,)), ("백만원", (1_000_000,)),
    ("3백만원", (3_000_000,)), ("5천만원", (50_000_000,)), ("만원짜리", (10_000,)), ("120000원", (120_000,)),
    ("노트북300만원", (3_000_000,)), ("치킨이 만원", (10_000,)), ("10만원 3만원", (100_000, 30_000)),
    # A Hangul numeral glued to a word is a particle, not a number; fail closed.
    ("치킨이만원", ()), ("구원", ()), ("원금", ()), ("1.5원", ()),
])
def test_amounts_are_read_as_people_type_them(text: str, amounts: tuple[int, ...]) -> None:
    assert purchase_amounts(text) == amounts


@pytest.mark.parametrize(("text", "envelopes"), [
    ("책", {"취미·여가"}), ("리조트", {"취미·여가"}), ("택시", {"교통비"}), ("감기약", {"의료·건강"}),
    ("헬스장", {"의료·건강"}), ("화장품", {"쇼핑"}), ("휴지", {"편의점·마트·잡화"}), ("치킨", {"외식"}),
    # A short word inside a longer matched word is not a second item.
    ("스마트폰", {"기타"}), ("게임기", {"기타"}), ("이마트", {"편의점·마트·잡화"}), ("pc방", {"취미·여가"}),
    ("여행가방", {"취미·여가", "쇼핑"}), ("돈이모자라", set()), ("예약", set()), ("반지하", set()),
    # An item word never spans the space between two typed words (택시 계좌 is not 시계).
    ("택시 계좌이체로", {"교통비"}),
])
def test_item_words_map_to_the_backend_subcategory_envelope(text: str, envelopes: set[str]) -> None:
    assert purchase_envelopes(text) == frozenset(envelopes)


@pytest.mark.parametrize(("question", "amount", "envelope", "date_token", "payment"), [
    ("100만원 리조트 이번 주에 현금 결제해도 괜찮아?", 1_000_000, "취미·여가", "this_week", "cash"),
    ("이번 주에 치킨 3만원 시켜 먹어도 괜찮아?", 30_000, "외식", "this_week", None),
    ("내일 5천원짜리 택시 체크카드로 탈 건데 괜찮아?", 5_000, "교통비", "tomorrow", "cash"),
    ("다음 주에 15,000원 게임기 살 건데 괜찮아?", 15_000, "기타", "next_week", None),
    ("휴지 15,000원 오늘 통장에서 살 예정인데 괜찮아?", 15_000, "편의점·마트·잡화", "today", "cash"),
    ("300만원 가방 내일 통장에서 살 건데 괜찮아?", 3_000_000, "쇼핑", "tomorrow", "cash"),
    ("스마트폰 100만원 내일 현금으로 사도 돼?", 1_000_000, "기타", "tomorrow", "cash"),
    (
        "이번 주말에 2.5만원짜리 콘서트 티켓 계좌이체로 사도 괜찮을까?",
        25_000, "취미·여가", "this_week", "cash",
    ),
])
def test_clear_purchases_are_admitted(
    question: str, amount: int, envelope: str, date_token: str, payment: str | None,
) -> None:
    parsed = natural_purchase(question)
    assert not isinstance(parsed, str), parsed
    assert parsed is not None
    assert (parsed.amount_krw, parsed.envelope, parsed.date_token, parsed.payment_hint) == (
        amount, envelope, date_token, payment,
    )


@pytest.mark.parametrize("question", [
    "카드값 30만원 결제해도 돼?",  # paying a bill, not buying
    "부산에 살 건데 월세 50만원이면 괜찮아?",  # 살다 = live
    "비트코인 사도 돼?",
    "삼성전자 주식 30만원어치 사도 될까?",
    "ETF 사면 괜찮아?",
    "이번 주에 영화 볼까?",
    "30만원 모을 수 있을까?",
    "이번 주에 30만원 써도 될까?",  # a spending verb needs a named item
])
def test_non_purchases_are_not_admitted(question: str) -> None:
    assert natural_purchase(question) is None


@pytest.mark.parametrize(("question", "code"), [
    ("3만원짜리 책 살 건데 예산 괜찮아?", "purchase_date_required"),
    ("치킨이만원 오늘 현금으로 사도 돼?", "purchase_amount_required"),
    ("여행가방 10만원 내일 현금으로 사도 돼?", "purchase_envelope_required"),
])
def test_a_purchase_missing_a_field_asks_for_it(question: str, code: str) -> None:
    assert natural_purchase(question) == code


@pytest.mark.parametrize(("followup", "fragment"), [
    ("30만원이요", True), ("현금으로 할게요", True), ("카드로요 결제일은 2026-10-15", True),
    ("노트북이요", True), ("내일이요", True),
    ("오늘 날씨 어때?", False), ("현금흐름이 뭐야?", False), ("영화 추천해줘", False),
    ("통장 잔고 얼마야", False),
])
def test_a_pending_purchase_absorbs_only_a_field_answer(followup: str, fragment: bool) -> None:
    assert is_bare_purchase_fragment(followup) is fragment


# --- routing guards ---------------------------------------------------------------------


@pytest.mark.parametrize(("question", "mode", "has_history", "off_topic"), [
    ("너 누구야?", "review", False, True),
    ("잠이 안 와", "risk", True, True),
    ("오늘 날씨 어때?", "review", True, True),
    ("파이썬 코드 짜줘", "finance", False, True),
    ("그럼 괜찮아?", "review", True, False),  # a follow-up on the previous answer
    ("왜?", "review", True, False),
    ("예산 괜찮아?", "review", False, False),
    ("오늘 날씨 어때?", "other", False, False),  # already out of scope
])
def test_a_no_money_question_is_never_answered_from_the_ledger(
    question: str, mode: str, has_history: bool, off_topic: bool,
) -> None:
    assert off_topic_route(question, mode, has_history=has_history, catalog_subject=False) is off_topic


def test_a_catalog_subject_is_never_sent_out_of_scope() -> None:
    assert not off_topic_route("리볼빙이 뭐야", "finance", has_history=False, catalog_subject=True)


@pytest.mark.parametrize("question", [
    "지금 가장 금리가 높은 예금은?", "요즘 정기예금 금리 몇 %야?", "요즘 파킹통장 금리 제일 높은 데 어디야?",
    "오늘 환율 얼마야?", "현재 기준금리 알려줘", "이번 달 제일 이자 많이 주는 은행 어디야?",
    "최신 적금 금리 비교해줘", "적금 금리 제일 높은 곳 어디야?",
])
def test_current_rate_questions_need_a_current_source(question: str) -> None:
    status = deterministic_finance_status(finance_evidence(question))
    assert status is not None
    assert status.answer_status == "needs_source"
    assert status.reference_ids == ()


@pytest.mark.parametrize("question", ["예금 가장 쉽게 설명해줘", "고정금리가 뭐야?", "실질금리 뜻 알려줘"])
def test_concept_questions_are_not_mistaken_for_current_rates(question: str) -> None:
    assert deterministic_finance_status(finance_evidence(question)) is None


@pytest.mark.parametrize(
    "question", ["비트코인 사도 돼?", "테슬라 주식 살까?", "이더리움 팔까?", "나스닥 ETF 담아도 돼?"],
)
def test_investment_buy_or_sell_is_declined_with_what_the_coach_can_do(question: str) -> None:
    status = deterministic_finance_status(finance_evidence(question))
    assert status is not None
    assert status.answer_status == "out_of_scope"
    assert status.text == (
        "특정 주식·펀드·코인을 사거나 팔지는 판단해 드리지 않아요. "
        "분산투자·ETF·채권 같은 개념 설명이나 이번 기간 예산·소비 확인은 도와드릴 수 있어요."
    )


@pytest.mark.parametrize(("question", "envelope"), [
    ("외식 예산 얼마 남았어", "외식"), ("식비 예산 얼마 남았어?", "외식"),
    ("마트 예산 얼마 남았어?", "편의점·마트·잡화"), ("취미 예산 얼마 남았어?", "취미·여가"),
    ("봉투 잔액 보여줘", None), ("외식이랑 쇼핑 예산 얼마 남았어?", None),
])
def test_a_balance_question_records_the_one_envelope_it_names(question: str, envelope: str | None) -> None:
    assert balance_envelope(question) == envelope


def test_money_left_at_month_end_is_a_forecast_and_now_is_not() -> None:
    assert deterministic_analysis_route("월말에 돈 얼마 남을까?") == "forecast"
    assert deterministic_analysis_route("이번달 돈 얼마 남았어?") != "forecast"


def test_account_balance_wording_with_jango_is_a_personal_lookup() -> None:
    assert deterministic_lookup_route("통장 잔고 얼마야") == "personal"


# --- purchase verdict -------------------------------------------------------------------


def _purchase_receipt(*, envelope: str, amount: int, left: int, planned_fraction: float) -> Receipt:
    identity = TwinIdentity(user_id="demo", twin_id="t1", revision=1, input_digest="d", as_of="2026-09-09")
    return Receipt(
        engine_commit="c",
        identity=identity,
        request=JsonDocument(
            root={"changes": [{"kind": "expense", "envelope": envelope, "amount_krw": amount}]}
        ),
        result=JsonDocument(root={"comparison": {
            "baseline": {"cash": {"period_account_shortfall": {"fraction": 0.0}}},
            "planned": {"cash": {
                "period_account_shortfall": {"fraction": planned_fraction},
                "terminal_balance": {"p50_krw": 1_000_000},
            }},
        }}),
        trigger="requested_review",
        current_envelopes=(
            Envelope(envelope=envelope, balance_krw=left),
            Envelope(envelope="교통비", balance_krw=150_000),
        ),
    )


@pytest.mark.parametrize(("amount", "left", "fraction", "first", "second"), [
    (30_000, 208_000, 0.0, "쇼핑 봉투 예산 안이고 예측상 계좌도 부족해지지 않아 괜찮아요.", None),
    (300_000, 208_000, 0.0,
     ("계좌 잔액으로는 결제할 수 있지만 쇼핑 봉투에 남은 208,000원보다 많아 "
      "봉투 예산을 92,000원 초과해요."), None),
    (30_000, -1_500, 0.0,
     ("계좌 잔액으로는 결제할 수 있지만 쇼핑 봉투는 이미 예산을 넘어서 "
      "이번 구매 30,000원이 그대로 초과 금액이 돼요."),
     None),
    (300_000, 208_000, 0.4,
     "구매 후 예측상 계좌 잔액이 부족해질 수 있어요.", "쇼핑 봉투 예산도 92,000원 초과해요."),
    (208_000, 208_000, 0.0, "쇼핑 봉투 예산 안이고 예측상 계좌도 부족해지지 않아 괜찮아요.", None),
])
def test_the_verdict_weighs_the_purchase_envelope_and_the_account(
    amount: int, left: int, fraction: float, first: str, second: str | None,
) -> None:
    receipt = _purchase_receipt(envelope="쇼핑", amount=amount, left=left, planned_fraction=fraction)
    pieces = purchase_verdict_text(receipt)
    assert pieces[0] == first
    if second is not None:
        assert pieces[1] == second
    assert pieces[-1] == ("부족 예측 있음." if fraction else "부족 예측 없음.")


def test_purchase_advice_is_about_the_purchase_only() -> None:
    within = _purchase_receipt(envelope="쇼핑", amount=30_000, left=208_000, planned_fraction=0.0)
    over = _purchase_receipt(envelope="쇼핑", amount=300_000, left=208_000, planned_fraction=0.0)
    short = _purchase_receipt(envelope="쇼핑", amount=300_000, left=208_000, planned_fraction=0.4)
    assert deterministic_advice(within) is None  # no savings nudge after "can I buy this?"
    assert deterministic_advice(over) == "**이 구매는 미루거나 다른 봉투에서 예산을 옮겨 보면 좋아요.**"
    assert deterministic_advice(over, tone="direct") == "**구매를 미루거나 다른 봉투 예산을 옮기세요.**"
    assert deterministic_advice(short) == (
        "이번 기간 현금이 부족할 수 있어요. **큰 지출은 미루는 편이 좋아요.**"
    )


# --- a compact in-suite sweep: family per question, whatever came before ----------------

_FAMILY_CASES = (
    ("복리가 뭐야?", "concept"), ("DSR 뜻 알려줘", "concept"), ("리볼빙이 뭐예요?", "concept"),
    ("지금 가장 금리가 높은 예금은?", "fin_needs_source"), ("오늘 환율 얼마야?", "fin_needs_source"),
    ("비트코인 사도 돼?", "fin_out_of_scope"), ("너 누구야?", "out_of_scope"),
    ("오늘 날씨 어때?", "out_of_scope"), ("봉투 잔액 보여줘", "balance"),
    ("외식 예산 얼마 남았어", "balance"), ("월말 잔액 얼마 남을까", "numeric:forecast"),
    ("월말에 돈 얼마 남을까?", "numeric:forecast"), ("이번 달 위험을 알려줘", "numeric:risk"),
    ("이번달 외식 얼마 썼어", "history"), ("통장 잔고 얼마야", "personal"),
    ("100만원 리조트 이번 주에 현금 결제해도 괜찮아?", "purchase"),
    ("3만원짜리 책 살 건데 예산 괜찮아?", "purchase_clarify"),
)
_CONTEXTS = (
    (),
    ("300만원 노트북 이번 주에 현금으로 사면 괜찮아?",),
    ("봉투 잔액 보여줘",),
    ("노트북 사려는데 괜찮아?",),  # leaves a pending purchase clarification
    ("다음주까지 예산 괜찮아?",),  # leaves a pending period clarification
)


def _family(body: dict[str, Any]) -> str:  # noqa: PLR0911 - one return per answer family.
    if "answer_type" in body:
        kind, status = body["answer_type"], body["status"]
        if kind == "finance_education":
            return "concept" if status == "answered" else "fin_" + status
        if kind == "scope_response":
            return "out_of_scope" if status == "out_of_scope" else "scope_" + status
        if kind == "purchase_review":
            return "purchase_clarify"
        return {"spending_history": "history", "personal_context": "personal"}.get(kind, kind)
    receipt = body["receipt"]
    if receipt["request"].get("operation") == "balance_check":
        return "balance"
    if receipt["numeric_request"] is not None:
        return "numeric:" + receipt["numeric_request"]["mode"]
    return "purchase" if receipt["request"].get("changes") else "review"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "context", _CONTEXTS,
    ids=["fresh", "after_purchase", "after_balance", "pending_purchase", "pending_period"],
)
async def test_each_question_keeps_its_family_after_any_prior_turn(
    tmp_path: Path, context: tuple[str, ...],
) -> None:
    async with httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=setup(tmp_path / "families.sqlite3", LiveRouter())),
        base_url="http://t",
        headers={"Authorization": "Bearer " + TOKEN},
    ) as client:
        pushed = await client.post(
            "/v1/twin", json=_funded_twin().model_dump(mode="json"), headers={"Idempotency-Key": "t"}
        )
        assert pushed.status_code == 200, pushed.text
        mismatches = []
        for index, (question, family) in enumerate(_FAMILY_CASES):
            created = await client.post("/v1/sessions", json={}, headers={"Idempotency-Key": f"s{index}"})
            path = f"/v1/sessions/{created.json()['id']}/messages"
            for step, prior in enumerate(context):
                await client.post(
                    path, json={"question": prior}, headers={"Idempotency-Key": f"p{index}-{step}"},
                )
            reply = await client.post(
                path, json={"question": question}, headers={"Idempotency-Key": f"q{index}"},
            )
            assert reply.status_code == 200, (question, reply.text)
            if _family(reply.json()) != family:
                mismatches.append((question, family, _family(reply.json())))
        assert mismatches == []
