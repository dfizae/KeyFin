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

import time
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
    investment_decision,
    is_bare_purchase_fragment,
    natural_purchase,
    purchase_amounts,
    purchase_envelopes,
    spending_followup_question,
    unanswerable_turn_code,
)
from coaching_service.finance_knowledge import (
    deterministic_finance_status,
    deterministic_finance_wording,
    finance_evidence,
    investment_decision_wording,
    model_selected_finance_evidence,
)
from coaching_service.llm_contract import EvidenceInput, Wording
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
    "오늘부터 커피 끊으면 한 달에 10만원 아낄 수 있을까?",  # 끊다 = quit
    "치킨 시키면 2만원이야?",  # asks a price
    "택시 타면 2만원 정도 나올까?",
    "매달 커피값으로 10만원 쓰면 1년이면 얼마야?",  # a habit, not one purchase
    "배달 끊으면 한 달에 30만원 아낄 수 있어?",
    "삼성전자 지금 사도 될까?",
    "KODEX 200 사도 돼?",
])
def test_non_purchases_are_not_admitted(question: str) -> None:
    assert natural_purchase(question) is None


@pytest.mark.parametrize(("question", "code"), [
    ("3만원짜리 책 살 건데 예산 괜찮아?", "purchase_date_required"),
    ("치킨이만원 오늘 현금으로 사도 돼?", "purchase_amount_required"),
    ("여행가방 10만원 내일 현금으로 사도 돼?", "purchase_envelope_required"),
    ("이번 주에 30만원 써도 될까?", "purchase_envelope_required"),  # paying verb, item unknown
    ("내일 현금으로 치킨 시켜도 돼?", "purchase_amount_required"),  # item verb, amount unknown
    ("내일 영화표 체크카드로 끊어도 될까?", "purchase_amount_required"),
    ("오늘 GPT 구독 3만원 결제해도 돼?", "purchase_envelope_required"),  # gpt is not PT
])
def test_a_purchase_missing_a_field_asks_for_it(question: str, code: str) -> None:
    assert natural_purchase(question) == code


@pytest.mark.parametrize(("followup", "fragment"), [
    ("30만원이요", True), ("현금으로 할게요", True), ("카드로요 결제일은 2026-10-15", True),
    ("노트북이요", True), ("내일이요", True),
    ("오늘 날씨 어때?", False), ("현금흐름이 뭐야?", False), ("영화 추천해줘", False),
    ("통장 잔고 얼마야", False),
    # hedged or dated answers are still just the field
    ("30만원 정도 할 것 같아요", True), ("30만원쯤 들 거 같아", True), ("카드요 다음 달 15일에 빠져나가요", True),
])
def test_a_pending_purchase_absorbs_only_a_field_answer(followup: str, fragment: bool) -> None:
    assert is_bare_purchase_fragment(followup) is fragment


# --- routing guards ---------------------------------------------------------------------


@pytest.mark.parametrize(("question", "mode", "off_topic"), [
    ("너 누구야?", "review", True),
    ("잠이 안 와", "risk", True),
    ("오늘 날씨 어때?", "review", True),
    ("파이썬 코드 짜줘", "finance", True),
    ("썸남한테 먼저 연락해도 될까?", "review", True),
    # the router keeps legitimate turns that happen to have no money word
    ("그럼 괜찮아?", "review", False),
    ("왜?", "review", False),
    ("지난달은?", "history", False),
    ("고정비 목록 보여줘", "personal", False),
    ("적자야?", "risk", False),
    ("배달 너무 많이 시켰나?", "review", False),
    ("예산 괜찮아?", "review", False),
    ("오늘 날씨 어때?", "other", False),  # already out of scope
])
def test_only_chit_chat_overrides_the_router(question: str, mode: str, off_topic: bool) -> None:
    assert off_topic_route(question, mode, catalog_subject=False) is off_topic


def test_a_catalog_subject_is_never_sent_out_of_scope() -> None:
    assert not off_topic_route("리볼빙이 뭐야", "finance", catalog_subject=True)


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


@pytest.mark.parametrize("question", [
    "예금 가장 쉽게 설명해줘", "고정금리가 뭐야?", "실질금리 뜻 알려줘", "요즘 적금이 뭐야?",
    "최근에 적금 들었는데 적금이 뭐야?", "올해 적금 처음 드는데 적금이 뭐야?",
])
def test_concept_questions_are_not_mistaken_for_current_rates(question: str) -> None:
    assert deterministic_finance_status(finance_evidence(question)) is None


@pytest.mark.parametrize("question", ["오늘 달러 매매기준율 얼마야?", "지금 엔화 100엔에 얼마야?"])
def test_todays_exchange_rate_needs_a_current_source(question: str) -> None:
    status = deterministic_finance_status(finance_evidence(question))
    assert status is not None
    assert status.answer_status == "needs_source"


@pytest.mark.parametrize(
    "question", ["비트코인 사도 돼?", "테슬라 주식 살까?", "이더리움 팔까?", "나스닥 ETF 담아도 돼?"],
)
def test_investment_buy_or_sell_is_declined_with_what_the_coach_can_do(question: str) -> None:
    assert investment_decision(question)
    status = investment_decision_wording()
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
    ("예산 괜찮을까요?", "review"), ("이번달 외식 얼마 썼어 ㅠㅠ", "history"),
    ("통장 잔고 얼마야~", "personal"),
    ("100만원 모을 수 있을까?", "period_review"), ("카드값 얼마 나와?", "personal"),
    ("현재 적금이 뭐야?", "concept"), ("삼성전자 지금 사도 될까?", "fin_out_of_scope"),
    ("이번 주 가방 10만원 현금으로 사도 돼?", "purchase"), ("어제 쓴 돈 총 얼마야?", "history"),
    ("내 빚 총 얼마야?", "personal"), ("월말까지 가면 얼마 남을까?", "numeric:forecast"),
    ("이번 달 리스크 분석 부탁해", "numeric:risk"), ("오늘 달러 매매기준율 얼마야?", "fin_needs_source"),
    ("잠이 안 오는데 어떻게 해?", "out_of_scope"), ("교통비 얼마 남았더라?", "balance"),
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


# --- a clear question missing one piece asks for it instead of the generic review ------


@pytest.mark.parametrize(("question", "code"), [
    ("100만원 모을 수 있을까?", "goal_period_required"),
    ("노트북 사려는데 200만원 모을 수 있을까?", "goal_period_required"),
    ("외식비 3만원 줄이면 어떻게 돼?", "what_if_percent_required"),
    ("이번달 외식 3만원 줄이면 괜찮아?", "what_if_percent_required"),
    ("이번 주에 얼마 썼어?", "spending_period_unsupported"),
    ("지난주 외식 얼마 썼어?", "spending_period_unsupported"),
    ("9월에 쇼핑 얼마 썼어?", "spending_period_unsupported"),
])
def test_the_missing_piece_is_named(question: str, code: str) -> None:
    assert unanswerable_turn_code(question) == code


@pytest.mark.parametrize("question", [
    "다음달 50만원 모을 수 있을까",  # a complete goal
    "이번 달 식비를 20% 줄이면 어떻게 될까?",  # a complete what-if
    "이번달 외식 얼마 썼어",  # a supported spending period
    "이번 주말에 얼마 쓸까?",  # a forecast, not a ledger query
    "비트코인 100만원 모을 수 있을까?",  # investment wording keeps its own route
])
def test_complete_questions_are_not_asked_again(question: str) -> None:
    assert unanswerable_turn_code(question) is None


def test_card_bill_wording_is_a_scheduled_payment_lookup() -> None:
    assert deterministic_lookup_route("카드값 얼마 나와?") == "personal"
    assert deterministic_lookup_route("카드대금 얼마야") == "personal"


# --- chat decoration and the budget from here on ----------------------------------------


@pytest.mark.parametrize(("question", "route"), [
    ("이번달 외식 얼마 썼어 ㅠㅠ", "history"), ("이번 달 소비 얼마야?~", "history"),
    ("통장 잔고 얼마야~", "personal"), ("계좌 잔액 보여줘 ㅋㅋ", "personal"),
    ("내 계좌 잔액 알려줘^^", "personal"),
])
def test_emoticons_and_tildes_do_not_break_a_lookup(question: str, route: str) -> None:
    assert deterministic_lookup_route(question) == route


@pytest.mark.parametrize("question", [
    "예산 괜찮을까요?", "이번 달 예산 괜찮을까?", "향후 예산 괜찮아?", "남은 기간 돈 버틸 수 있을까?",
    "생활비 이번 달 버틸 수 있을까?", "월말까지 예산 괜찮아?",
])
def test_the_budget_from_here_on_is_a_period_review(question: str) -> None:
    assert deterministic_analysis_route(question) == "review"
    evidence = finance_evidence(question)
    assert deterministic_finance_wording(evidence) is None
    assert model_selected_finance_evidence(evidence) is None


@pytest.mark.parametrize("question", ["예산 괜찮아?", "300만원 노트북 사면 예산 괜찮을까?", "예산이 뭐야?"])
def test_present_balance_purchases_and_definitions_are_not_period_reviews(question: str) -> None:
    assert deterministic_analysis_route(question) != "review"


# --- adversarial review findings (2026-09-27) --------------------------------------------


def test_a_long_digit_run_is_read_in_linear_time_and_never_overflows() -> None:
    started = time.perf_counter()
    assert natural_purchase("주문번호 " + "1" * 400 + " 확인해줘") is None
    assert natural_purchase("노트북 " + "9" * 310 + "원 사도 돼?") == "purchase_amount_required"
    assert unanswerable_turn_code("1" + "0" * 400 + "만원 모을 수 있을까?") is None
    assert time.perf_counter() - started < 1.0


@pytest.mark.parametrize(("text", "amounts"), [
    ("1.12만원", (11_200,)), ("0.07만원", (700,)), ("16.1천원", (16_100,)),
    ("0만원", ()), ("0억원", ()), ("1만2만원", ()), ("천만원", (10_000_000,)),
])
def test_amounts_use_exact_arithmetic_and_descending_units(text: str, amounts: tuple[int, ...]) -> None:
    assert purchase_amounts(text) == amounts


@pytest.mark.parametrize(("question", "envelope"), [
    ("이번 주 가방 10만원 현금으로 사도 돼?", "쇼핑"),  # 이번 주 가방 is not 주가
    ("주식 공부용 책 3만원 오늘 현금으로 사도 돼?", "취미·여가"),  # buying a book
    ("노트북 200만원이라면 오늘 사도 돼?", "기타"),  # 이라면 is not 라면
    ("필요가 없는데 가방 10만원 오늘 사도 돼?", "쇼핑"),  # 필요가 is not 요가
    ("오늘 스마트 워치 30만원 사도 돼?", "기타"),  # 스마트 is not 마트
    ("스마트 TV 100만원 오늘 사도 돼?", "기타"),
    ("애플 워치 50만원 오늘 현금으로 사도 돼?", "기타"),  # a product, not the stock
    ("오늘 버블티 7천원 체크카드로 사 먹어도 돼? ㅠ", "외식"),
    ("오늘 택시비 12,000원 체크카드로 내도 돼?", "교통비"),
    ("러닝화 11만원 이번 주에 계좌이체로 사도 괜찮을까?", "쇼핑"),
])
def test_item_words_do_not_collide_with_everyday_words(question: str, envelope: str) -> None:
    parsed = natural_purchase(question)
    assert not isinstance(parsed, str), parsed
    assert parsed is not None
    assert parsed.envelope == envelope


@pytest.mark.parametrize("question", [
    "비트코인에 돈 넣어도 괜찮을까?", "주식에 돈 넣어도 괜찮을까?", "생활비 대출 받아도 괜찮을까?",
    "친구한테 돈 빌려줘도 괜찮을까?", "돈까스 먹어도 괜찮을까?",
])
def test_a_verb_between_the_budget_noun_and_the_outcome_is_not_a_period_review(question: str) -> None:
    assert deterministic_analysis_route(question) != "review"


@pytest.mark.parametrize("question", [
    "이번 달 예산 끝까지 버틸 수 있을까?", "월말까지 버틸 수 있을 만큼 예산 있어?", "월말까지 버틸 돈 있을까?",
    "이 페이스면 월말까지 돈 버티겠어?", "혹시 남은 기간 예산 버틸 만해?",
])
def test_the_budget_holding_up_in_other_words_is_a_period_review(question: str) -> None:
    assert deterministic_analysis_route(question) == "review"


@pytest.mark.parametrize(("question", "code"), [
    ("1년 동안 1000만원 모을 수 있을까?", "goal_period_unsupported"),
    ("6개월 안에 500만원 모을 수 있을까?", "goal_period_unsupported"),
    ("연말까지 200만원 모을 수 있을까?", "goal_period_unsupported"),
    ("외식비 줄여서 30만원 모으려면 어떻게 해야 돼?", None),  # a how-to question
    ("외식비 월 10만원 아끼면 1년에 얼마야?", None),  # arithmetic
    ("취미·여가 봉투에서 6만원 빼면 어떻게 될까?", "what_if_percent_required"),
    ("지난주 총 소비 알려줘", "spending_period_unsupported"),
    ("9월 교통비 얼마 나갔어?", "spending_period_unsupported"),
])
def test_the_named_missing_piece_matches_what_was_said(question: str, code: str | None) -> None:
    assert unanswerable_turn_code(question) == code


def test_an_envelope_with_nothing_left_is_not_called_already_over() -> None:
    pieces = purchase_verdict_text(_purchase_receipt(envelope="쇼핑", amount=30_000, left=0, planned_fraction=0.0))
    assert pieces[0] == (
        "계좌 잔액으로는 결제할 수 있지만 쇼핑 봉투에 남은 예산이 없어 "
        "이번 구매 30,000원이 그대로 초과 금액이 돼요."
    )


@pytest.mark.parametrize(("question", "family"), [
    ("다음달까지 60만원 모을 수 있어?", "numeric:goal"),
    ("월말 전에 10만원 모으는 거 가능?", "numeric:goal"),
    ("다음 달에 150만원 모으면 무리야?", "numeric:goal"),
    ("이번 달 교통비 30% 줄이면 월말 잔액 얼마 돼?", "numeric:what_if"),
    ("외식 15% 덜 쓰면 이번 달 어떻게 될까?", "numeric:what_if"),
    ("이번 달 쇼핑 20퍼센트 줄이면 어떻게 될까?", "numeric:what_if"),
    ("이번 달 교통비 총 얼마 나올 것 같아?", "numeric:forecast"),
    ("월말 남는 금액 예상치 알려줘", "numeric:forecast"),
    ("이번 달 위험 요소 뭐 있어?", "numeric:risk"),
    ("카드값 얼마 나왔어?", "personal"),
    ("통장에 돈 얼마 있는지 확인해줘", "personal"),
    ("지난달 총 소비 얼마였지?", "history"),
    ("이번 달 외식비로 나간 돈 합계 보여줘", "history"),
    ("교통비 봉투 지금 얼마 있어?", "balance"),
])
@pytest.mark.anyio
async def test_everyday_wording_reaches_its_own_calculation(tmp_path: Path, question: str, family: str) -> None:
    answers = await _conversation(tmp_path, (question,), one_session=True, router=LiveRouter())
    assert _family(answers[0]) == family


@pytest.mark.parametrize(("turns", "family"), [
    (("100만원 모을 수 있을까?", "다음 달까지"), "numeric:goal"),
    (("외식비 3만원 줄이면 어떻게 돼?", "20%"), "numeric:what_if"),
    (("이번 주에 얼마 썼어?", "이번 달"), "history"),
    (("지난주 외식 얼마 썼어?", "지난달"), "history"),
    (("이번 달 외식 얼마 썼어?", "지난달은?"), "history"),
    (("노트북 오늘 현금으로 사도 돼?", "30만원 정도 할 것 같아요"), "purchase"),
])
@pytest.mark.anyio
async def test_the_answer_to_a_clarification_completes_the_question(
    tmp_path: Path, turns: tuple[str, ...], family: str,
) -> None:
    answers = await _conversation(tmp_path, turns, one_session=True, router=LiveRouter())
    assert _family(answers[-1]) == family


def test_a_spending_follow_up_keeps_the_envelope() -> None:
    assert spending_followup_question("지난달은?", "이번 달 외식 얼마 썼어?") == "지난달 외식 얼마 썼어?"
    assert spending_followup_question("다음 달은?", "이번 달 외식 얼마 썼어?") is None


class _HistoryCapture(LiveRouter):
    def __init__(self) -> None:
        super().__init__()
        self.turn = 0
        self.finance_history: list[tuple[int, int]] = []

    async def write(self, evidence: EvidenceInput) -> Wording:
        if evidence.purpose == "finance":
            self.finance_history.append((self.turn, len(evidence.history)))
        return await super().write(evidence)


@pytest.mark.anyio
async def test_the_models_fact_selection_keeps_the_conversation(tmp_path: Path) -> None:
    router = _HistoryCapture()
    async with httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=setup(tmp_path / "history.sqlite3", router)),
        base_url="http://t",
        headers={"Authorization": "Bearer " + TOKEN},
    ) as client:
        created = await client.post("/v1/sessions", json={}, headers={"Idempotency-Key": "s"})
        path = f"/v1/sessions/{created.json()['id']}/messages"
        for turn, question in enumerate(("체크카드가 뭐야?", "신용카드랑 차이가 뭐야?")):
            router.turn = turn
            reply = await client.post(path, json={"question": question}, headers={"Idempotency-Key": f"q{turn}"})
            assert reply.status_code == 200, reply.text
    # a model fact selection may run on the follow-up, but never without the history it needs
    assert all(length > 0 for turn, length in router.finance_history if turn == 1)
