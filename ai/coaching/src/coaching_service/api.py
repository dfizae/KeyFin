"""Standalone authenticated financial coaching API."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from coaching_service.auth import Authenticate
from coaching_service.chart_routes import register_charts
from coaching_service.coaching import CoachingCore, LanguageModel
from coaching_service.engine import ENGINE_COMMIT
from coaching_service.http_errors import register_errors
from coaching_service.llm import OpenAICompatibleCoachModel, create_http_client
from coaching_service.provenance import verify_engine
from coaching_service.repository import Repository
from coaching_service.routes import register_coaching, register_records, register_twin
from coaching_service.schemas import (
    JsonDocument,
)
from coaching_service.settings import Settings
from coaching_service.store import Store
from coaching_service.transport import BodyLimit


def create_app(settings: Settings, model: LanguageModel | None = None) -> FastAPI:
    verified_files = verify_engine()
    client = create_http_client(settings.model)
    core = CoachingCore(
        Repository(Store(settings.database)),
        model or OpenAICompatibleCoachModel(settings.model, client=client),
    )
    auth = Authenticate(settings.clients)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        async with client:
            yield

    app = FastAPI(title="FDT AI Coaching", version="0.3.0", lifespan=lifespan)
    app.add_middleware(BodyLimit)

    async def health() -> JsonDocument:
        return JsonDocument.model_validate(
            {
                "status": "ok",
                "engine_commit": ENGINE_COMMIT,
                "engine_files_verified": verified_files,
                "model_configured": settings.model.endpoint_url is not None,
            }
        )

    register_errors(app)
    app.add_api_route("/healthz", health, methods=["GET"])
    register_twin(app, core, auth)
    register_coaching(app, core, auth)
    register_records(app, core, auth)
    register_charts(app, core, auth)
    return app


def from_environment() -> FastAPI:
    return create_app(Settings())
