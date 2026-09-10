"""The service checks the exact request with the serving tokenizer before generation."""
# ruff: noqa: INP001
from __future__ import annotations

import hashlib
import json

import httpx2
import pytest

from coaching_service.llm import OpenAICompatibleCoachModel
from coaching_service.llm_contract import EvidenceInput, ModelConfig
from coaching_service.llm_prompt import user_payload
from coaching_service.schemas import JsonDocument


def test_user_payload_embeds_exact_facts_without_double_json_string_encoding() -> None:
    facts = JsonDocument.model_validate({"status": "missing", "amount": None, "warning": '확인 \\"필요\\"'})
    payload = JsonDocument.model_validate_json(
        user_payload(EvidenceInput(facts_json=facts.model_dump_json())),
    )
    assert payload.root["evidence_json"] == facts.root


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
@pytest.mark.parametrize("prompt_tokens", [8192, 8193])
async def test_actual_token_limit_blocks_only_overflow_before_generation(prompt_tokens: int) -> None:
    paths: list[str] = []
    bodies: list[bytes] = []

    def respond(request: httpx2.Request) -> httpx2.Response:
        paths.append(request.url.path)
        bodies.append(request.content)
        if request.url.path == "/v1/tokenize":
            return httpx2.Response(200, json={
                "prompt_tokens": prompt_tokens,
                "max_input_tokens": 8192,
                "max_output_tokens": 1536,
                "request_sha256": hashlib.sha256(request.content).hexdigest(),
                "prompt_sha256": "a" * 64,
            })
        assert request.headers["X-Coaching-Prompt-Sha256"] == "a" * 64
        return httpx2.Response(200, json={"choices": [{"index": 0,
            "message": {"role": "assistant", "content": "확인할 자료를 알려 주세요."},
            "finish_reason": "stop"}]})

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(respond)) as client:
        result = await OpenAICompatibleCoachModel(
            ModelConfig(endpoint_url="http://model.test"), client=client,
        ).write(EvidenceInput(facts_json='{"status":"ready"}'))
    assert paths[0] == "/v1/tokenize"
    if prompt_tokens == 8193:
        assert paths == ["/v1/tokenize"]
        assert result.source == "template"
        assert result.fallback_reason == "input_token_limit"
    else:
        assert result.source == "llm"
        assert paths == ["/v1/tokenize", "/v1/chat/completions"]
        assert bodies[0] == bodies[1]


@pytest.mark.anyio
@pytest.mark.parametrize("failure", ["missing_endpoint", "wrong_hash", "invalid_limits", "oversized"])
async def test_unverifiable_token_budget_never_reaches_generation(failure: str) -> None:
    paths: list[str] = []

    def respond(request: httpx2.Request) -> httpx2.Response:
        paths.append(request.url.path)
        if failure == "missing_endpoint":
            return httpx2.Response(404)
        budget = {
            "prompt_tokens": 100, "max_input_tokens": 8192, "max_output_tokens": 1536,
            "request_sha256": hashlib.sha256(request.content).hexdigest(), "prompt_sha256": "a" * 64,
        }
        if failure == "wrong_hash":
            budget["request_sha256"] = "b" * 64
        if failure == "invalid_limits":
            budget["max_input_tokens"] = 0
        content = json.dumps(budget).encode() if failure != "oversized" else b"x" * 4097
        return httpx2.Response(200, content=content)

    async with httpx2.AsyncClient(transport=httpx2.MockTransport(respond)) as client:
        result = await OpenAICompatibleCoachModel(
            ModelConfig(endpoint_url="http://model.test"), client=client,
        ).write(EvidenceInput(facts_json="{}"))
    assert paths == ["/v1/tokenize"]
    assert result.source == "template"
    assert result.fallback_reason is not None
    assert result.fallback_reason.startswith("token_preflight_")
