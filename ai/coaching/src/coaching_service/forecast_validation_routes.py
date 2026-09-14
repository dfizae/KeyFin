"""Authenticated HTTP adapters for the independent outcome-comparison workflow."""

import time
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, FastAPI

from coaching_service.auth import Authenticate
from coaching_service.coaching import CoachingCore
from coaching_service.forecast_validation import ForecastValidation
from coaching_service.forecast_validation_contracts import (
    MetricReport,
    MetricRequest,
    ObservationRequest,
    Registration,
    RegistrationRequest,
    Settlement,
)
from coaching_service.http_contracts import RequestKey, operation
from coaching_service.repository import document
from coaching_service.schemas import Identifier


def register_forecast_validation(
    app: FastAPI,
    core: CoachingCore,
    auth: Authenticate,
    *,
    clock: Callable[[], float] = time.time,
) -> None:
    """Backend registers and attests coverage; the user can inspect their own results."""
    validation = ForecastValidation(core, clock)

    async def register(
        body: RegistrationRequest, key: RequestKey, owner: Annotated[str, Depends(auth.backend)]
    ) -> Registration:
        result = await validation.register(operation(owner, "forecast-register", key, document(body)), body)
        return Registration.model_validate(result.root)

    async def get_registration(
        registration_id: Identifier, owner: Annotated[str, Depends(auth.user)]
    ) -> Registration:
        return await validation.registration(owner, registration_id)

    async def settle(
        registration_id: Identifier,
        body: ObservationRequest,
        key: RequestKey,
        owner: Annotated[str, Depends(auth.backend)],
    ) -> Settlement:
        result = await validation.settle(
            operation(owner, "forecast-settle/" + registration_id, key, document(body)),
            registration_id,
            body,
        )
        return Settlement.model_validate(result.root)

    async def get_settlement(
        registration_id: Identifier, owner: Annotated[str, Depends(auth.user)]
    ) -> Settlement:
        return await validation.settlement(owner, registration_id)

    async def metrics(body: MetricRequest, owner: Annotated[str, Depends(auth.user)]) -> MetricReport:
        return await validation.metrics(owner, body)

    app.add_api_route(
        "/v1/forecast-validation/registrations",
        register,
        methods=["POST"],
        response_model=Registration,
    )
    app.add_api_route(
        "/v1/forecast-validation/registrations/{registration_id}",
        get_registration,
        methods=["GET"],
        response_model=Registration,
    )
    app.add_api_route(
        "/v1/forecast-validation/registrations/{registration_id}/settlement",
        settle,
        methods=["POST"],
        response_model=Settlement,
    )
    app.add_api_route(
        "/v1/forecast-validation/registrations/{registration_id}/settlement",
        get_settlement,
        methods=["GET"],
        response_model=Settlement,
    )
    app.add_api_route(
        "/v1/forecast-validation/metrics",
        metrics,
        methods=["POST"],
        response_model=MetricReport,
    )
