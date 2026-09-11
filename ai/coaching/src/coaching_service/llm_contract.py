"""Frozen boundaries for evidence-only language-model operations."""

from __future__ import annotations

import json
from typing import Annotated, ClassVar, Final, Literal, Protocol, Self
from urllib.parse import urlsplit, urlunsplit

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    SecretStr,
    TypeAdapter,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

Source = Literal["llm", "template"]
Mode = Literal["review", "risk", "forecast"]
Operation = Literal["write", "judge", "route"]
_FACTS: Final = TypeAdapter(dict[str, JsonValue])


class FrozenContract(BaseModel):
    """Parse boundary values strictly and reject undeclared output fields."""

    model_config: ClassVar[ConfigDict] = ConfigDict(
        frozen=True,
        strict=True,
        extra="forbid",
        allow_inf_nan=False,
    )


class ChatMessage(FrozenContract):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=3000)]


class EvidenceInput(FrozenContract):
    purpose: Literal["coaching", "chart"] = "coaching"
    question: Annotated[str, Field(max_length=4000)] = ""
    facts_json: Annotated[str, Field(min_length=2, max_length=64000)]
    history: Annotated[tuple[ChatMessage, ...], Field(max_length=16)] = ()

    @field_validator("facts_json")
    @classmethod
    def valid_facts(cls, value: str) -> str:
        facts = _FACTS.validate_json(value)
        try:
            return json.dumps(facts, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        except ValueError as error:
            raise PydanticCustomError(
                "nonfinite_evidence",
                "Evidence must contain finite JSON values",
            ) from error


class Wording(FrozenContract):
    text: Annotated[str, Field(min_length=1, max_length=400)]
    source: Source
    fallback_reason: str | None = None
    model: str


class JudgmentDraft(FrozenContract):
    decision: Literal["coach", "skip", "needs_data"]
    reason_code: Literal["context_concern", "no_additional_concern", "insufficient_context"]
    confidence: Annotated[float, Field(ge=0, le=1)]

    @model_validator(mode="after")
    def consistent_reason(self) -> Self:
        allowed = {
            ("coach", "context_concern"),
            ("skip", "no_additional_concern"),
            ("needs_data", "insufficient_context"),
        }
        if (self.decision, self.reason_code) not in allowed:
            raise PydanticCustomError("inconsistent_judgment", "Decision and reason must agree")
        return self


class Judgment(JudgmentDraft):
    source: Source
    fallback_reason: str | None = None


class RoutingDraft(FrozenContract):
    mode: Mode


class Routing(RoutingDraft):
    source: Source
    fallback_reason: str | None = None


class ModelConfig(FrozenContract):
    endpoint_url: str | None = None
    token: SecretStr | None = None
    token_preflight: bool = True
    model: Annotated[str, Field(min_length=1, max_length=200)] = "coaching-model"
    timeout_seconds: Annotated[float, Field(gt=0, le=120)] = 30.0
    connect_timeout_seconds: Annotated[float, Field(gt=0, le=30)] = 5.0
    read_timeout_seconds: Annotated[float, Field(gt=0, le=120)] = 30.0
    write_timeout_seconds: Annotated[float, Field(gt=0, le=30)] = 10.0
    pool_timeout_seconds: Annotated[float, Field(gt=0, le=30)] = 1.0
    max_tokens: Annotated[int, Field(ge=16, le=1024)] = 256
    max_response_bytes: Annotated[int, Field(ge=1024, le=1048576)] = 65536
    max_concurrency: Annotated[int, Field(ge=1, le=8)] = 2

    @field_validator("endpoint_url")
    @classmethod
    def scoped_endpoint(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        parts = urlsplit(value)
        if parts.port is not None and not 1 <= parts.port <= 65535:
            raise PydanticCustomError("invalid_model_port", "The model port is outside its valid range")
        if (
            parts.scheme not in {"http", "https"}
            or not parts.hostname
            or parts.username is not None
            or parts.password is not None
            or parts.query
            or parts.fragment
        ):
            raise PydanticCustomError(
                "invalid_model_endpoint",
                "Use an absolute model endpoint without credentials",
            )
        path = parts.path.rstrip("/")
        if path not in {"", "/v1", "/v1/chat/completions"}:
            raise PydanticCustomError("invalid_model_path", "The model path must be /v1/chat/completions")
        return urlunsplit((parts.scheme, parts.netloc, "/v1/chat/completions", "", ""))

    @field_validator("token")
    @classmethod
    def valid_token(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            secret = value.get_secret_value()
            if not secret.isascii() or "\r" in secret or "\n" in secret:
                raise PydanticCustomError(
                    "invalid_model_token",
                    "The model token contains invalid header characters",
                )
        return value


class CoachModel(Protocol):
    async def write(self, evidence: EvidenceInput) -> Wording: ...

    async def judge(self, evidence: EvidenceInput) -> Judgment: ...

    async def route(self, evidence: EvidenceInput) -> Routing: ...


class CompletionMessage(FrozenContract):
    role: Literal["assistant"] = "assistant"
    content: Annotated[str, Field(min_length=1, max_length=8192)]
    refusal: None = None


class CompletionChoice(FrozenContract):
    index: Literal[0] = 0
    message: CompletionMessage
    finish_reason: Literal["stop"]
    logprobs: None = None


class CompletionEnvelope(FrozenContract):
    """Ignore transport bookkeeping only; choices and messages remain strict."""

    model_config: ClassVar[ConfigDict] = ConfigDict(
        frozen=True,
        strict=True,
        extra="ignore",
        allow_inf_nan=False,
    )
    choices: Annotated[tuple[CompletionChoice, ...], Field(min_length=1, max_length=1)]
