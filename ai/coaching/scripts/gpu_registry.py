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
    """운영자가 허용한 장치 중 하나를 명시한 경우만 기동한다. 장치를 자동 선택하지 않는다."""
    selected = environment.get("CUDA_VISIBLE_DEVICES", "").strip()
    allowed = environment.get("COACH_GPU_ALLOWED_DEVICES", "").split(",")
    if not selected or "," in selected or selected not in {item.strip() for item in allowed if item.strip()}:
        raise RuntimeError("explicit_single_authorized_accelerator_required")


def load_entry(path: Path, tag: str) -> ModelEntry:
    """허용된 태그의 체크포인트·revision·설정 해시를 개인 설정에서 한 건만 읽는다.

    태그는 지원 런타임의 계약이고 모델 경로·물리 자원은 저장소의 상수가 아니다.
    중복 태그는 첫 항목을 임의 선택하지 않고 기동 오류로 처리한다.
    """
    registry = Registry.model_validate_json(path.read_bytes())
    if len({entry.tag for entry in registry.models}) != len(registry.models):
        raise ValueError("duplicate_model_tag")
    matches = [entry for entry in registry.models if entry.tag == tag]
    if len(matches) != 1:
        raise ValueError("model_tag_not_registered")
    return matches[0]
