"""Verify the serving tokenizer's budget for the exact bytes sent to generation."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Annotated

import anyio
import httpx2
from pydantic import Field

from coaching_service.llm_contract import FrozenContract


class TokenBudget(FrozenContract):
    prompt_tokens: Annotated[int, Field(ge=1)]
    max_input_tokens: Annotated[int, Field(ge=1)]
    max_output_tokens: Annotated[int, Field(ge=1)]
    request_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    prompt_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]


@dataclass(frozen=True, slots=True)
class BudgetFailure:
    reason: str


def validate_budget(body: bytearray, request: httpx2.Request, max_tokens: int) -> TokenBudget | BudgetFailure:
    try:
        budget = TokenBudget.model_validate_json(body)
    except ValueError:
        return BudgetFailure("token_preflight_invalid_schema")
    if budget.request_sha256 != hashlib.sha256(request.content).hexdigest():
        return BudgetFailure("token_preflight_request_mismatch")
    if budget.prompt_tokens > budget.max_input_tokens:
        return BudgetFailure("input_token_limit")
    if max_tokens > budget.max_output_tokens:
        return BudgetFailure("output_token_limit")
    return budget


async def check_token_budget(
    client: httpx2.AsyncClient, request: httpx2.Request, max_tokens: int,
) -> TokenBudget | BudgetFailure:
    """Keep auth scoped, read bounded metadata, and never estimate tokens from characters."""
    preflight = httpx2.Request(
        "POST", request.url.copy_with(path="/v1/tokenize"),
        headers=request.headers, content=request.content, extensions=request.extensions,
    )
    response = await client.send(preflight, stream=True, auth=None, follow_redirects=False)
    try:
        if response.status_code != 200:
            return BudgetFailure(f"token_preflight_http_status_{response.status_code}")
        body = bytearray()
        async for chunk in response.aiter_bytes():
            if len(body) + len(chunk) > 4096:
                return BudgetFailure("token_preflight_response_limit")
            body.extend(chunk)
        return validate_budget(body, request, max_tokens)
    finally:
        with anyio.move_on_after(0.1, shield=True):
            await response.aclose()
