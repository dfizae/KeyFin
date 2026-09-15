# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# How to run: imported by gpu_worker.py in the pinned existing GPU environment.
"""Token-budget enforcement over the explicitly configured model checkpoint."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from pathlib import Path
from threading import RLock
from typing import TYPE_CHECKING

from fastapi import HTTPException
from gpu_models import generate, load_model

if TYPE_CHECKING:
    from .gpu_contracts import CompletionRequest, Generated, Metadata, PromptCount
    from .gpu_worker import generation_messages
else:  # noqa: PLR5501 - Keep the TYPE_CHECKING runtime boundary for basedpyright.
    if __package__:
        from .gpu_contracts import CompletionRequest, Generated, Metadata, PromptCount
        from .gpu_worker import generation_messages
    else:
        from gpu_contracts import CompletionRequest, Generated, Metadata, PromptCount
        from gpu_worker import generation_messages


class PinnedBackend:
    """Own the single loaded model and tokenizer for this worker process."""

    def __init__(self, tag: str) -> None:
        if tag not in {"base8", "latest27_nf4"}:
            raise ValueError("unsupported_model_tag")
        self.model, self.tokenizer, entry = load_model(tag)
        # Rust tokenizers mutate padding/truncation configuration during batch encoding.
        # CPU preflight uses its own clone so it can run while the GPU is generating.
        self.count_tokenizer = deepcopy(self.tokenizer)
        self.count_lock = RLock()
        self.metadata = Metadata(
            model=tag,
            model_id=entry.model_id,
            revision=entry.revision,
            config_sha256=entry.config_sha256,
            quantization=entry.quantization,
            runtime_sha256=hashlib.sha256(
                Path(__file__).with_name("gpu_models.py").read_bytes(),
            ).hexdigest(),
        )

    def measure(self, request: CompletionRequest) -> PromptCount:
        """생성과 같은 스키마·chat template·특수 토큰으로 센다.

        모델 ID·revision·token_ids로 지문을 만들어 사전 검사와 생성 사이의 입력
        변경을 감지한다. 단순 JSON 글자 수나 본문 해시로 이 지문을 대신하지 않는다.
        """
        chat = [
            {"role": message.role, "content": message.content} for message in generation_messages(request)
        ]
        with self.count_lock:
            prompt = self.count_tokenizer.apply_chat_template(
                chat, tokenize=False, add_generation_prompt=True, enable_thinking=False,
            )
            token_ids = self.count_tokenizer.encode(prompt)
        identity = json.dumps([self.metadata.model_id, self.metadata.revision, token_ids])
        return PromptCount(
            prompt_tokens=len(token_ids), prompt_sha256=hashlib.sha256(identity.encode()).hexdigest(),
        )

    def complete(self, request: CompletionRequest) -> Generated:
        """Single-request callers use the same batch implementation and guards."""
        return self.complete_batch([request])[0]

    def complete_batch(self, requests: list[CompletionRequest]) -> list[Generated]:
        """각 요청의 토큰·출력 상한을 유지하며 한 번의 generate로 독립 답변을 만든다."""
        if not requests or len({request.max_tokens for request in requests}) != 1:
            raise ValueError("incompatible_generation_batch")
        counts = [self.measure(request) for request in requests]
        if any(count.prompt_tokens > self.metadata.max_input_tokens for count in counts):
            raise HTTPException(status_code=413, detail="input_token_limit")
        chats = [[{"role": message.role, "content": message.content}
                  for message in generation_messages(request)] for request in requests]
        texts, seconds, input_tokens, output_tokens = generate(
            self.model,
            self.tokenizer,
            chats,
            max_tokens=requests[0].max_tokens,
            thinking=False,
        )
        if input_tokens != [count.prompt_tokens for count in counts]:
            raise HTTPException(status_code=500, detail="tokenizer_count_mismatch")
        return [Generated(text=text, prompt_tokens=inputs, completion_tokens=outputs, seconds=seconds)
                for text, inputs, outputs in zip(texts, input_tokens, output_tokens, strict=True)]
