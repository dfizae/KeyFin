# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# How to run: imported by gpu_worker.py in the pinned existing GPU environment.
"""Token-budget enforcement over the explicitly configured model checkpoint."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastapi import HTTPException
from gpu_models import generate, load_model
from gpu_worker import CompletionRequest, Generated, Metadata, PromptCount, generation_messages


class PinnedBackend:
    """Own the single loaded model and tokenizer for this worker process."""

    def __init__(self, tag: str) -> None:
        if tag not in {"base8", "latest27_nf4"}:
            raise ValueError("unsupported_model_tag")
        self.model, self.tokenizer, entry = load_model(tag)
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
        prompt = self.tokenizer.apply_chat_template(
            chat,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )
        token_ids = self.tokenizer.encode(prompt)
        identity = json.dumps([self.metadata.model_id, self.metadata.revision, token_ids])
        return PromptCount(
            prompt_tokens=len(token_ids), prompt_sha256=hashlib.sha256(identity.encode()).hexdigest(),
        )

    def complete(self, request: CompletionRequest) -> Generated:
        """결정적 디코딩을 사용하고 실제 생성의 입력 토큰 수도 사전 검사와 대조한다."""
        count = self.measure(request)
        if count.prompt_tokens > self.metadata.max_input_tokens:
            raise HTTPException(status_code=413, detail="input_token_limit")
        chat = [
            {"role": message.role, "content": message.content} for message in generation_messages(request)
        ]
        texts, seconds, input_tokens, output_tokens = generate(
            self.model,
            self.tokenizer,
            [chat],
            max_tokens=request.max_tokens,
            thinking=False,
        )
        if input_tokens[0] != count.prompt_tokens:
            raise HTTPException(status_code=500, detail="tokenizer_count_mismatch")
        return Generated(
            text=texts[0], prompt_tokens=input_tokens[0], completion_tokens=output_tokens[0], seconds=seconds
        )
