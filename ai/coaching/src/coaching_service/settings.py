"""Private backend identity and model configuration from the environment only."""

from pathlib import Path
from typing import ClassVar, Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from coaching_service.llm_contract import ModelConfig
from coaching_service.schemas import Frozen, Identifier


class Client(Frozen):
    user_id: Identifier
    token: SecretStr = Field(min_length=32)
    role: Literal["backend", "user", "notification"] = "backend"


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_prefix="COACHING_", frozen=True, extra="forbid"
    )
    database: Path = Path("state/coaching.sqlite3")
    clients: tuple[Client, ...] = Field(default=(), min_length=1, max_length=1000, validate_default=True)
    model: ModelConfig = ModelConfig()

    @model_validator(mode="after")
    def unique_tokens(self) -> Self:
        if len({row.token.get_secret_value() for row in self.clients}) != len(self.clients):
            raise ValueError("duplicate_authentication_tokens")
        return self
