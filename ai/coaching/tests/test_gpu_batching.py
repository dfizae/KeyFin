"""Concurrent requests must batch without mixing responses or weakening token checks."""
# ruff: noqa: INP001

import hashlib
import threading

import anyio
import httpx2
import pytest
from fastapi import HTTPException

from scripts.gpu_batching import BatchDispatcher, Pending
from scripts.gpu_worker import CompletionRequest, Generated, Metadata, PromptCount, create_app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class BatchBackend:
    metadata = Metadata(model="fixture", model_id="fixture", revision="a" * 40,
                        config_sha256="b" * 64, runtime_sha256="c" * 64, quantization="fixture")

    def __init__(self) -> None:
        self.batches: list[list[str]] = []
        self.entered = threading.Event()
        self.release = threading.Event()
        self.block = False

    def measure(self, request: CompletionRequest) -> PromptCount:
        text = request.messages[0].content
        return PromptCount(prompt_tokens=len(text), prompt_sha256=hashlib.sha256(text.encode()).hexdigest())

    def complete(self, request: CompletionRequest) -> Generated:
        return self.complete_batch([request])[0]

    def complete_batch(self, requests: list[CompletionRequest]) -> list[Generated]:
        texts = [request.messages[0].content for request in requests]
        self.batches.append(texts)
        self.entered.set()
        if self.block:
            assert self.release.wait(timeout=3), "test_release_missing"
        return [Generated(text=text, prompt_tokens=len(text), completion_tokens=1, seconds=0.01)
                for text in texts]


TOKEN = "synthetic-batching-test-worker-token"
HEADERS = {"Authorization": "Bearer " + TOKEN}


def body(text: str, max_tokens: int = 32) -> dict[str, str | int | list[dict[str, str]]]:
    return {"model": "fixture", "messages": [{"role": "user", "content": text}], "max_tokens": max_tokens}


@pytest.mark.anyio
async def test_concurrent_requests_share_generation_and_preserve_each_response() -> None:
    # Given: a worker that can generate two independent replies in one batch.
    backend = BatchBackend()
    app = create_app(backend, TOKEN, batch_complete=backend.complete_batch, max_batch_size=2)
    replies: dict[str, httpx2.Response] = {}
    async with app.router.lifespan_context(app), httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app), base_url="http://test",
    ) as client:
        # When: two different prompts arrive together.
        async def send(text: str) -> None:
            replies[text] = await client.post("/v1/chat/completions", headers=HEADERS, json=body(text))
        async with anyio.create_task_group() as group:
            group.start_soon(send, "first")
            group.start_soon(send, "second")
    # Then: a single generation returns each caller's own text and token counts.
    assert len(backend.batches) == 1
    assert len(backend.batches[0]) == 2
    assert all(reply.status_code == 200 and reply.json()["choices"][0]["message"]["content"] == text
               and reply.json()["usage"]["prompt_tokens"] == len(text) for text, reply in replies.items())


@pytest.mark.anyio
async def test_tokenization_does_not_wait_for_an_active_generation() -> None:
    # Given: a running GPU generation held by a deterministic event.
    backend = BatchBackend()
    backend.block = True
    app = create_app(backend, TOKEN, batch_complete=backend.complete_batch, max_batch_size=2)
    async with app.router.lifespan_context(app), httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app), base_url="http://test",
    ) as client:
        async def generate() -> None:
            response = await client.post("/v1/chat/completions", headers=HEADERS, json=body("active"))
            assert response.status_code == 200
        async with anyio.create_task_group() as group:
            group.start_soon(generate)
            assert await anyio.to_thread.run_sync(backend.entered.wait, 2)
            try:
                # When: a different request asks for a CPU token count.
                with anyio.fail_after(1):
                    counted = await client.post("/v1/tokenize", headers=HEADERS, json=body("count"))
                # Then: it finishes while generation is still blocked.
                assert counted.status_code == 200
                assert counted.json()["prompt_tokens"] == 5
            finally:
                backend.release.set()


@pytest.mark.parametrize(("second_limit", "second_length", "compatible"), [
    (32, 10, True), (64, 10, False), (32, 8192, False),
])
def test_batch_preserves_output_limit_and_padded_token_budget(
    second_limit: int, second_length: int, compatible: bool,
) -> None:
    backend = BatchBackend()
    dispatcher = BatchDispatcher(backend.complete_batch, 4)
    first = Pending(CompletionRequest.model_validate(body("first")), 10)
    second = Pending(CompletionRequest.model_validate(body("second", second_limit)), second_length)
    assert dispatcher.compatible([first], second) is compatible


@pytest.mark.anyio
async def test_failed_batch_wakes_every_caller_and_next_batch_can_recover() -> None:
    calls = 0

    def complete(requests: list[CompletionRequest]) -> list[Generated]:
        nonlocal calls
        calls += 1
        if calls == 1:
            # Wrong output cardinality must fail the entire batch, including its first item.
            return []
        return [Generated(text="recovered", prompt_tokens=1, completion_tokens=1, seconds=0.01)]

    dispatcher = BatchDispatcher(complete, 2)
    failed = [Pending(CompletionRequest.model_validate(body(text)), 1) for text in ("a", "b")]
    await dispatcher.generate(failed)
    assert all(item.ready.is_set() and isinstance(item.result, HTTPException)
               and item.result.status_code == 503 for item in failed)
    recovered = Pending(CompletionRequest.model_validate(body("c")), 1)
    await dispatcher.generate([recovered])
    assert isinstance(recovered.result, Generated)
    assert recovered.result.text == "recovered"


@pytest.mark.anyio
async def test_cancelled_queued_request_is_not_generated_and_shutdown_wakes_waiters() -> None:
    backend = BatchBackend()
    dispatcher = BatchDispatcher(backend.complete_batch, 2)
    skipped = Pending(CompletionRequest.model_validate(body("cancelled")), 1, cancelled=True)
    live = Pending(CompletionRequest.model_validate(body("live")), 1)
    dispatcher.sender.send_nowait(skipped)
    dispatcher.sender.send_nowait(live)
    waiting = Pending(CompletionRequest.model_validate(body("waiting")), 1)
    dispatcher.pending.append(waiting)
    async with anyio.create_task_group() as group:
        await group.start(dispatcher.run)
        with anyio.fail_after(2):
            await live.ready.wait()
        group.cancel_scope.cancel()
    assert backend.batches == [["live"]]
    assert waiting.ready.is_set()
    assert not dispatcher.running


@pytest.mark.anyio
async def test_batch_mode_rejects_long_input_before_generation() -> None:
    backend = BatchBackend()
    app = create_app(backend, TOKEN, batch_complete=backend.complete_batch, max_batch_size=2)
    async with app.router.lifespan_context(app), httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app), base_url="http://test",
    ) as client:
        response = await client.post("/v1/chat/completions", headers=HEADERS, json=body("x" * 8193))
    assert response.status_code == 413
    assert response.json()["detail"] == "input_token_limit"
    assert backend.batches == []
