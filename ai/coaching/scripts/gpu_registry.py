"""Private deployment configuration; machine identity is never a response field."""

from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field


class ModelEntry(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    tag: Literal["base8", "latest27_nf4"]
    model_id: str
    path: Path
    revision: str = Field(pattern=r"^[0-9a-f]{40}$")
    config_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    quantization: Literal["bf16", "nf4"]


class Registry(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True, extra="forbid")
    models: tuple[ModelEntry, ...] = Field(min_length=1, max_length=2)


def validate_device(environment: Mapping[str, str]) -> None:
    selected = environment.get("CUDA_VISIBLE_DEVICES", "").strip()
    allowed = environment.get("COACH_GPU_ALLOWED_DEVICES", "").split(",")
    if not selected or "," in selected or selected not in {item.strip() for item in allowed if item.strip()}:
        raise RuntimeError("explicit_single_authorized_accelerator_required")


def load_entry(path: Path, tag: str) -> ModelEntry:
    registry = Registry.model_validate_json(path.read_bytes())
    if len({entry.tag for entry in registry.models}) != len(registry.models):
        raise ValueError("duplicate_model_tag")
    matches = [entry for entry in registry.models if entry.tag == tag]
    if len(matches) != 1:
        raise ValueError("model_tag_not_registered")
    return matches[0]
