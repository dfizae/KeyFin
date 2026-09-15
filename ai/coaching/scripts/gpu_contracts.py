# /// script
# requires-python = ">=3.11"
# dependencies = ["pydantic"]
# ///
# How to run: imported by package tests or standalone gpu_worker.py.
"""Shared immutable worker contracts without HTTP execution or runtime imports."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, JsonValue


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
