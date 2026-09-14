# ruff: noqa: INP001
"""Direct answers must contain source facts, not just pass an HTTP/router check."""

from __future__ import annotations

import json

import httpx2
import pytest

from coaching_service.finance_knowledge import finance_evidence, selected_finance_wording
from coaching_service.llm import OpenAICompatibleCoachModel
from coaching_service.llm_contract import ModelConfig


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def test_definition_contains_answer_and_verified_reference() -> None:
    answer = selected_finance_wording('{"status":"answered","fact_ids":["compound_interest"]}', "test-model")
    assert "이자에도 이자" in answer.text
    assert "investor.gov" in answer.text
    assert answer.answer_status == "answered"
    assert answer.reference_ids == ("compound_interest",)
    assert answer.source == "llm"


@pytest.mark.parametrize(
    "raw",
    [
        '{"status":"answered","fact_ids":["invented"]}',
        '{"status":"answered","fact_ids":[]}',
        '{"status":"needs_source","fact_ids":["compound_interest"]}',
        '{"status":"answered","fact_ids":["compound_interest","compound_interest"]}',
        '{"status":"answered","fact_ids":["compound_interest"],"text":"잔액은 999원"}',
    ],
)
def test_untrusted_selection_never_invents_financial_answer(raw: str) -> None:
    answer = selected_finance_wording(raw, "test-model")
    assert answer.source == "template"
    assert answer.fallback_reason == "invalid_finance_selection"
    assert not answer.reference_ids


@pytest.mark.anyio
async def test_general_question_uses_selection_prompt_and_reuses_bounded_transport() -> None:
    seen: list[dict] = []

    def respond(request: httpx2.Request) -> httpx2.Response:
        seen.append(json.loads(request.content))
        return httpx2.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {"content": '{"status":"answered","fact_ids":["dsr"]}'},
                        "finish_reason": "stop",
                    }
                ]
            },
        )

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(respond)) as client:
        model = OpenAICompatibleCoachModel(
            ModelConfig(endpoint_url="http://localhost/v1", token_preflight=False), client=client
        )
        reply = await model.write(finance_evidence("DSR이 뭐야?"))
    assert reply.source == "llm"
    assert "연간 소득" in reply.text
    assert "원리금" in reply.text
    assert seen[0]["response_format"]["json_schema"]["name"] == "finance_facts"
    assert "fact_ids" in seen[0]["messages"][0]["content"]
