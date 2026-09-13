# /// script
# requires-python = ">=3.11"
# dependencies = ["fastapi", "uvicorn", "anyio", "pydantic"]
# ///
# How to run: COACH_GPU_MODEL=latest27_nf4 pinned-python gpu_worker.py
"""Authenticated loopback OpenAI subset backed by the pinned GPU runtime."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import stat
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, ClassVar, Literal, Protocol

import anyio
import uvicorn
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, JsonValue
from starlette.responses import JSONResponse, Response

if TYPE_CHECKING:
    from starlette.middleware.base import RequestResponseEndpoint


class Frozen(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")


class Message(Frozen):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=32000)


class SchemaRequest(Frozen):
    name: str
    strict: bool = True
    schema_: JsonValue = Field(alias="schema")


class ResponseFormat(Frozen):
    type: Literal["json_object", "json_schema", "text"]
    json_schema: SchemaRequest | None = None


class CompletionRequest(Frozen):
    model: str
    messages: tuple[Message, ...] = Field(min_length=1, max_length=16)
    max_tokens: int = Field(default=256, ge=1, le=1536)
    temperature: Literal[0] = 0
    stream: Literal[False] = False
    response_format: ResponseFormat | None = None


class Metadata(Frozen):
    model: str
    model_id: str
    revision: str
    config_sha256: str
    runtime_sha256: str
    quantization: str
    logical_gpu: Literal[0] = 0
    max_input_tokens: Literal[8192] = 8192
    max_output_tokens: Literal[1536] = 1536
    grammar_enforced: Literal[False] = False
    response_format_handling: Literal["schema_in_prompt"] = "schema_in_prompt"
    tokenizer_contract: Literal["coaching-token-budget/1"] = "coaching-token-budget/1"


class PromptCount(Frozen):
    prompt_tokens: int = Field(ge=1)
    prompt_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class TokenBudget(PromptCount):
    request_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    max_input_tokens: int = Field(ge=1)
    max_output_tokens: int = Field(ge=1)


@dataclass(frozen=True, slots=True)
class Generated:
    text: str
    prompt_tokens: int
    completion_tokens: int
    seconds: float


class Backend(Protocol):
    @property
    def metadata(self) -> Metadata: ...

    def complete(self, request: CompletionRequest) -> Generated: ...

    def measure(self, request: CompletionRequest) -> PromptCount: ...


class Choice(Frozen):
    index: Literal[0] = 0
    message: Message
    finish_reason: Literal["stop", "length"]


class Usage(Frozen):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class CompletionResponse(Frozen):
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    system_fingerprint: str
    choices: tuple[Choice, ...]
    usage: Usage
    generation_seconds: float


def generation_messages(request: CompletionRequest) -> tuple[Message, ...]:
    """응답 스키마까지 포함한 실제 생성 메시지를 만든다.

    이 런타임은 문법 강제 디코더가 없어 스키마를 지시문에 넣고 클라이언트가 결과를
    다시 검증한다. 합쳐진 내용도 메시지 한도를 검사해야 Pydantic 오류가 500이 되지 않는다.
    measure와 complete는 모두 이 함수를 사용해야 토큰 사전 검사가 같은 입력을 센다.
    """
    if request.response_format is None or request.response_format.type == "text":
        return request.messages
    specification = request.response_format.model_dump(mode="json", by_alias=True, exclude_none=True)
    content = json.dumps({"response_format": specification}, ensure_ascii=False)
    if request.messages[0].role == "system":
        content = request.messages[0].content + "\n" + content
        remaining = request.messages[1:]
    else:
        remaining = request.messages
    if len(content) > 32000:
        raise HTTPException(status_code=413, detail="input_character_limit")
    return (Message(role="system", content=content), *remaining)


async def bound_body(request: Request, call_next: RequestResponseEndpoint) -> Response:
    """Reject oversized or unbounded body framing before JSON parsing."""
    if request.method == "POST":
        raw_length = request.headers.get("content-length", "")
        if not raw_length.isdigit() or int(raw_length) > 65536:
            return JSONResponse(status_code=413, content={"detail": "request_body_limit"})
    return await call_next(request)


def validate_prompt_count(count: PromptCount, metadata: Metadata, expected: str | None) -> None:
    """실제 토큰 상한과 사전 검사 때의 프롬프트 지문을 생성 직전에 다시 확인한다.

    글자 수 검사는 토큰 검사를 대신하지 않는다. 지문 변경은 409로 중단하며
    비 ASCII 헤더는 compare_digest의 예외 대신 명시적인 오류로 처리한다.
    """
    if count.prompt_tokens > metadata.max_input_tokens:
        raise HTTPException(status_code=413, detail="input_token_limit")
    if expected is not None and (
        not expected.isascii() or not secrets.compare_digest(expected, count.prompt_sha256)
    ):
        raise HTTPException(status_code=409, detail="tokenizer_preflight_changed")


def create_app(backend: Backend, token: str) -> FastAPI:
    """토큰 검사 또는 생성 작업 1개와 대기 요청 1개만 허용하고 나머지는 429다.

    슬롯은 토큰 검사·추론 성공/실패 모두에서 해제한다. 이 동시성 정책은 현재
    단일 backend의 자원 보호용이며 배치 추론 성능을 보장하는 설정은 아니다.
    """
    if len(token) < 32:
        raise ValueError("token_too_short")
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    slots = anyio.CapacityLimiter(2)
    gpu = anyio.CapacityLimiter(1)
    _ = app.middleware("http")(bound_body)

    async def health() -> Metadata:
        return backend.metadata

    def admit(request: CompletionRequest, authorization: str | None) -> None:
        """인증·모델·스키마를 합친 글자 수를 확인한 뒤에만 대기 슬롯을 점유한다."""
        if (
            authorization is None or not authorization.isascii()
            or not secrets.compare_digest(authorization, f"Bearer {token}")
        ):
            raise HTTPException(status_code=401, detail="unauthorized")
        if request.model not in {backend.metadata.model, backend.metadata.model_id}:
            raise HTTPException(status_code=404, detail="model_not_loaded")
        if sum(len(message.content) for message in generation_messages(request)) > 48000:
            raise HTTPException(status_code=413, detail="input_character_limit")
        try:
            slots.acquire_nowait()
        except anyio.WouldBlock as exc:
            raise HTTPException(status_code=429, detail="queue_full") from exc

    async def tokenize(
        request: CompletionRequest, raw: Request,
        authorization: Annotated[str | None, Header()] = None,
    ) -> TokenBudget:
        """본문 원본 해시와 chat template 적용 후 토큰 수·지문을 함께 돌려준다.

        클라이언트는 원본 해시로 다른 요청의 검사값 혼용을 막고, 서버는 생성 전에
        프롬프트 지문을 재확인한다. 이 응답은 모델 답변 생성의 성공 증거가 아니다.
        """
        admit(request, authorization)
        try:
            async with gpu:
                count = await anyio.to_thread.run_sync(backend.measure, request)
        finally:
            slots.release()
        return TokenBudget(
            prompt_tokens=count.prompt_tokens, prompt_sha256=count.prompt_sha256,
            request_sha256=hashlib.sha256(await raw.body()).hexdigest(),
            max_input_tokens=backend.metadata.max_input_tokens,
            max_output_tokens=backend.metadata.max_output_tokens,
        )

    async def complete(
        request: CompletionRequest,
        authorization: Annotated[str | None, Header()] = None,
        x_coaching_prompt_sha256: Annotated[str | None, Header()] = None,
    ) -> CompletionResponse:
        admit(request, authorization)
        try:
            async with gpu:
                count = await anyio.to_thread.run_sync(backend.measure, request)
                validate_prompt_count(count, backend.metadata, x_coaching_prompt_sha256)
                result = await anyio.to_thread.run_sync(backend.complete, request)
        finally:
            slots.release()
        return CompletionResponse(
            id="chatcmpl-" + secrets.token_hex(12),
            created=int(time.time()),
            model=backend.metadata.model,
            system_fingerprint=backend.metadata.config_sha256,
            choices=(
                Choice(
                    message=Message(role="assistant", content=result.text),
                    finish_reason="length" if result.completion_tokens >= request.max_tokens else "stop",
                ),
            ),
            usage=Usage(
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                total_tokens=result.prompt_tokens + result.completion_tokens,
            ),
            generation_seconds=result.seconds,
        )

    app.add_api_route("/health", health, methods=["GET"])
    app.add_api_route("/v1/tokenize", tokenize, methods=["POST"])
    app.add_api_route("/v1/chat/completions", complete, methods=["POST"])
    return app


def main() -> None:
    """Load only on the authorized device; read the private token from disk."""
    from gpu_registry import validate_device  # noqa: PLC0415

    validate_device(os.environ)
    root = Path(os.environ["COACH_GPU_WORKSPACE"])
    if not root.is_absolute() or root.is_symlink() or root.stat().st_uid != os.getuid():
        raise RuntimeError("workspace_ownership_invalid")
    port = int(os.environ.get("COACH_GPU_PORT", "18743"))
    if not 1024 <= port <= 65535:
        raise RuntimeError("worker_port_invalid")
    token_path = root / "worker.token"
    file_stat = token_path.stat()
    if stat.S_IMODE(file_stat.st_mode) != 0o600 or file_stat.st_uid != os.getuid():
        raise RuntimeError("token_permissions_invalid")
    from gpu_runtime import PinnedBackend  # noqa: PLC0415

    backend = PinnedBackend(os.environ["COACH_GPU_MODEL"])
    _ = (root / "worker_metadata.json").write_text(
        backend.metadata.model_dump_json(indent=2), encoding="utf-8"
    )
    print("GPU_WORKER_MODEL_READY", flush=True)
    uvicorn.run(
        create_app(backend, token_path.read_text().strip()),
        host="127.0.0.1",
        port=port,
        access_log=False,
        log_level="warning",
        limit_concurrency=8,
        timeout_keep_alive=5,
    )


if __name__ == "__main__":
    main()
