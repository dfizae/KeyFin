# ruff: noqa: INP001
"""Two coaching-quality improvements, guards unchanged.

#1 Counseling-shaped questions now match EXISTING approved concepts (via added
   aliases only) and reach the model finance-selection path (source=llm), instead
   of falling through to review->template. The volatile/decision carve-out block
   is unchanged: live-rate and purchase-decision questions still never reach it.
#2 A lowest-precedence healthy/surplus branch in ``deterministic_advice`` fires
   only on the engine's own high ``remaining_percent`` fact, is digit-free, and
   never disturbs the over-budget > near-limit > shortfall precedence.
"""

from __future__ import annotations

import pytest

from coaching_service.finance_knowledge import (
    deterministic_finance_status,
    deterministic_finance_wording,
    finance_evidence,
    model_selected_finance_evidence,
)
from coaching_service.knowledge_retrieval import retrieve_facts
from coaching_service.rendering import deterministic_advice
from coaching_service.schemas import Receipt

# ---------------------------------------------------------------------------
# #1 alias-driven counseling questions reach the model finance-selection path
# ---------------------------------------------------------------------------

_ALIAS_QUESTIONS = [
    ("지출 줄이기", "budget"),
    ("소비 습관 점검", "budget"),
    ("예산 세우기", "budget"),
    ("저축 늘리기", "budget"),
    ("빚 갚는 순서", "debt_repayment_methods"),
    ("목돈 모으기", "deposits"),
    ("비상금 모으기", "emergency_fund"),
]


@pytest.mark.parametrize(("question", "concept"), _ALIAS_QUESTIONS)
def test_counseling_question_reaches_model_finance_selection(question: str, concept: str) -> None:
    # The added alias makes the question retrieve the intended approved concept.
    assert concept in {fact.id for fact in retrieve_facts(question)}
    evidence = finance_evidence(question)
    # It is not an exact catalog definition, so no deterministic template answer,
    # and it is not a live-rate/tax status question either.
    assert deterministic_finance_wording(evidence) is None
    assert deterministic_finance_status(evidence) is None
    # It therefore reaches the bounded model finance-selection path (source=llm),
    # not the review->template fallback.
    assert model_selected_finance_evidence(evidence) is not None


@pytest.mark.parametrize(
    "question",
    [
        "지금 예금 금리 얼마야?",
        "대출을 받을까 말까?",
        "오늘 가장 높은 적금 금리 추천해줘",
    ],
)
def test_alias_expansion_does_not_open_the_volatile_block(question: str) -> None:
    # Aliases must never let a volatile/decision question bypass the block: it
    # stays out of both the deterministic template and the model finance path.
    evidence = finance_evidence(question)
    assert deterministic_finance_wording(evidence) is None
    assert model_selected_finance_evidence(evidence) is None


# ---------------------------------------------------------------------------
# #2 lowest-precedence healthy/surplus advice branch (fact-gated, digit-free)
# ---------------------------------------------------------------------------


def _base_receipt(**overrides: object) -> Receipt:
    payload: dict[str, object] = {
        "engine_commit": "pinned-engine",
        "identity": {
            "user_id": "user",
            "twin_id": "twin",
            "revision": 1,
            "input_digest": "digest",
            "as_of": "2026-09-21",
        },
        "request": {"on_date": "2026-09-21", "through_date": "2026-09-28"},
        "result": {},
        "trigger": "requested_review",
    }
    payload.update(overrides)
    return Receipt.model_validate(payload)


def _payment_receipt(remaining_percent: str) -> Receipt:
    return _base_receipt(
        payment={
            "transaction_id": "t1",
            "envelope": "외식",
            "amount_krw": 1000,
            "balance_before_krw": 50000,
            "balance_after_krw": 49000,
            "remaining_percent": remaining_percent,
            "weekly_count": 1,
        }
    )


def _shortfall_receipt() -> Receipt:
    return _base_receipt(
        request={
            "on_date": "2026-09-21",
            "through_date": "2026-09-28",
            "changes": [{"kind": "expense", "envelope": "쇼핑", "amount_krw": 200000}],
        },
        result={
            "comparison": {
                "baseline": {"cash": {"period_account_shortfall": {"fraction": 0}}},
                "planned": {
                    "cash": {
                        "period_account_shortfall": {"fraction": 0.3},
                        "terminal_balance": {"p50_krw": 50000},
                    }
                },
            }
        },
    )


def test_healthy_surplus_branch_fires_only_on_the_surplus_fact() -> None:
    advice = deterministic_advice(_payment_receipt("90"))
    assert advice is not None
    assert "외식" in advice
    assert not any(char.isdigit() for char in advice)


def test_healthy_branch_requires_the_surplus_fact_to_be_present() -> None:
    # No payment fact at all -> no surplus signal -> no advice (not every account).
    assert deterministic_advice(_base_receipt()) is None


def test_healthy_band_lower_boundary_is_inclusive_and_moderate_is_silent() -> None:
    assert deterministic_advice(_payment_receipt("80")) is not None
    assert deterministic_advice(_payment_receipt("79")) is None
    assert deterministic_advice(_payment_receipt("50")) is None


def test_healthy_branch_never_overrides_over_budget_near_limit_or_shortfall() -> None:
    over_budget = deterministic_advice(_payment_receipt("0"))
    near_limit = deterministic_advice(_payment_receipt("8"))
    healthy = deterministic_advice(_payment_receipt("90"))
    assert over_budget is not None
    assert near_limit is not None
    assert healthy is not None
    assert len({over_budget, near_limit, healthy}) == 3
    # Shortfall still wins over the healthy branch when both could be read.
    assert deterministic_advice(_shortfall_receipt()) == deterministic_advice(
        _shortfall_receipt(), tone="encouraging"
    )
    assert "부족" in deterministic_advice(_shortfall_receipt())


def test_healthy_branch_tone_variants_are_distinct_and_digit_free() -> None:
    encouraging = deterministic_advice(_payment_receipt("90"), tone="encouraging")
    direct = deterministic_advice(_payment_receipt("90"), tone="direct")
    default = deterministic_advice(_payment_receipt("90"))
    assert encouraging is not None
    assert direct is not None
    assert encouraging != direct
    assert default == encouraging
    for text in (encouraging, direct):
        assert "외식" in text
        assert not any(char.isdigit() for char in text)
