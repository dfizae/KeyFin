"""Async boundary around short SQLite operations."""

from collections.abc import Awaitable, Callable

import anyio
from pydantic import BaseModel

from coaching_service.errors import ServiceError
from coaching_service.schemas import Frozen, JsonDocument
from coaching_service.store import Operation, Store, Write


class Mutation(Frozen):
    result: JsonDocument
    writes: tuple[Write, ...] = ()


def document(value: BaseModel) -> JsonDocument:
    return JsonDocument.model_validate_json(value.model_dump_json())


def write(key: str, value: BaseModel) -> Write:
    return Write(key=key, payload=value.model_dump_json())


class Repository:
    def __init__(self, store: Store) -> None:
        self.store: Store = store

    async def load(self, owner: str, key: str) -> str:
        value = await anyio.to_thread.run_sync(self.store.load, owner, key)
        if value is None:
            raise ServiceError("resource_not_found", 404)
        return value

    async def mutate(self, operation: Operation, action: Callable[[], Awaitable[Mutation]]) -> JsonDocument:
        reservation = await anyio.to_thread.run_sync(self.store.reserve, operation)
        if reservation.cached is not None:
            return reservation.cached
        lease = reservation.lease
        if lease is None:
            raise ServiceError("reservation_failed", 503)
        try:
            with anyio.fail_after(150):
                change = await action()
                await anyio.to_thread.run_sync(self.store.commit, lease, change.writes, change.result)
                return change.result
        except TimeoutError:
            raise ServiceError("operation_deadline", 503) from None
        finally:
            with anyio.CancelScope(shield=True):
                await anyio.to_thread.run_sync(self.store.release, lease)
