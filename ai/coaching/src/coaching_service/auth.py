"""Bind every request to a configured principal, never a body-supplied user ID."""

import hmac
from typing import Annotated, Final

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from coaching_service.errors import ServiceError
from coaching_service.settings import Client

BEARER: Final = HTTPBearer(auto_error=False)
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(BEARER)]


class Authenticate:
    def __init__(self, clients: tuple[Client, ...]) -> None:
        self.clients: tuple[Client, ...] = clients

    def principal(self, credentials: HTTPAuthorizationCredentials | None) -> Client:
        if credentials is not None:
            for client in self.clients:
                if hmac.compare_digest(
                    credentials.credentials.encode(), client.token.get_secret_value().encode()
                ):
                    return client
        raise ServiceError("authentication_required", 401)

    def backend(self, credentials: Credentials) -> str:
        client = self.principal(credentials)
        if client.role != "backend":
            raise ServiceError("backend_role_required", 403)
        return client.user_id

    def user(self, credentials: Credentials) -> str:
        client = self.principal(credentials)
        if client.role not in {"user", "backend"}:
            raise ServiceError("user_role_required", 403)
        return client.user_id

    def notification(self, credentials: Credentials) -> str:
        client = self.principal(credentials)
        if client.role not in {"notification", "backend"}:
            raise ServiceError("notification_role_required", 403)
        return client.user_id
