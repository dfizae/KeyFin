# ruff: noqa: INP001
"""Question relevance, stale-source exclusion, and deployment corpus integrity."""

from __future__ import annotations

import json
from datetime import date
from typing import TYPE_CHECKING

import pytest

from coaching_service.finance_knowledge import finance_evidence, selected_finance_wording
from coaching_service.knowledge_catalog import KnowledgeCatalog, load_catalog
from coaching_service.knowledge_retrieval import retrieve_facts
from coaching_service.llm_contract import ChatMessage

if TYPE_CHECKING:
    from pathlib import Path


def test_new_subjects_are_retrieved_without_loading_twin() -> None:
    facts = retrieve_facts("채권 듀레이션은 무엇이고 금리가 오르면 왜 가격이 떨어져?")
    assert "bond_duration" in {fact.id for fact in facts}
    assert len(facts) <= 8
    evidence = json.loads(finance_evidence("순자산이 뭐야?").facts_json)
    assert "net_worth" in {fact["id"] for fact in evidence["knowledge_facts"]}
    assert len(evidence["catalog_sha256"]) == 64
    assert "transactions" not in evidence


def test_valid_but_unretrieved_id_cannot_answer_question() -> None:
    reply = selected_finance_wording(
        '{"status":"answered","fact_ids":["revolving"]}', "test",
        evidence=finance_evidence("복리가 뭐야?"),
    )
    assert reply.answer_status == "unavailable"
    assert reply.reference_ids == ()
    assert reply.fallback_reason == "invalid_finance_selection"


def test_unknown_subject_does_not_borrow_past_topic() -> None:
    history = (ChatMessage(role="user", content="복리가 뭐야?"),)
    assert retrieve_facts("오늘 날씨 알려줘", history) == ()
    assert retrieve_facts("그럼 바젤3가 뭐야?", history) == ()
    assert "compound_interest" in {row.id for row in retrieve_facts("그럼 더 설명해줘", history)}
    assert "compound_interest" not in {row.id for row in retrieve_facts("리볼빙 위험은?", history)}
    continued = (*history, ChatMessage(role="user", content="그럼 더 설명해줘"))
    assert "compound_interest" in {row.id for row in retrieve_facts("장단점은?", continued)}
    changed = (*continued, ChatMessage(role="user", content="그럼 바젤3가 뭐야?"))
    assert retrieve_facts("더 설명해줘", changed) == ()


@pytest.mark.parametrize("question", [
    "그럼 조금 더 자세히 설명해 줘.",
    "그러면 자세하게 알려 주세요!",
    "그것은 좀 더 상세히 설명해 주세요",
])
def test_natural_followup_keeps_last_explicit_subject(question: str) -> None:
    # 설명의 길이·띄어쓰기가 달라도 직전 사용자가 지정한 주제만 가져온다.
    history = (ChatMessage(role="user", content="복리가 뭐야?"),)
    assert "compound_interest" in {row.id for row in retrieve_facts(question, history)}
    assert retrieve_facts(question) == ()
    changed = (*history, ChatMessage(role="user", content="바젤3가 뭐야?"))
    assert retrieve_facts(question, changed) == ()


def test_expired_sources_cannot_be_sent_to_model() -> None:
    catalog = load_catalog()
    assert retrieve_facts("복리", catalog=catalog, today=date(2030, 1, 1)) == ()
    assert retrieve_facts("복리", catalog=catalog, today=date(2020, 1, 1)) == ()


def test_catalog_rejects_duplicate_ids_and_untrusted_source() -> None:
    payload = load_catalog().model_dump(mode="json")
    duplicate = json.loads(json.dumps(payload))
    duplicate["facts"].append(duplicate["facts"][0])
    with pytest.raises(ValueError, match="Duplicate"):
        KnowledgeCatalog.model_validate_json(json.dumps(duplicate))
    payload["facts"][0]["source_url"] = "https://untrusted.invalid/finance"
    with pytest.raises(ValueError, match="Invalid finance knowledge source"):
        KnowledgeCatalog.model_validate_json(json.dumps(payload))


def test_catalog_never_ships_replacement_character_text() -> None:
    payload = load_catalog().model_dump(mode="json")
    assert "\ufffd" not in json.dumps(payload, ensure_ascii=False)
    payload["facts"][0]["text"] = "\ufffd"
    with pytest.raises(ValueError, match="Invalid finance knowledge source"):
        KnowledgeCatalog.model_validate_json(json.dumps(payload))


def test_external_corpus_cannot_overflow_three_fact_answer() -> None:
    payload = load_catalog().model_dump(mode="json")
    for fact in payload["facts"][:3]:
        fact["text"] = "설명" * 300
        fact["source_url"] = "https://www.investor.gov/" + "a" * 400
    with pytest.raises(ValueError, match="exceeds response limit"):
        KnowledgeCatalog.model_validate_json(json.dumps(payload))


def test_external_corpus_requires_hash(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "corpus.json"
    path.write_text(load_catalog().model_dump_json(), encoding="utf-8")
    monkeypatch.setenv("COACHING_KNOWLEDGE_FILE", str(path))
    monkeypatch.delenv("COACHING_KNOWLEDGE_SHA256", raising=False)
    load_catalog.cache_clear()
    try:
        with pytest.raises(ValueError, match="hash mismatch"):
            load_catalog()
    finally:
        monkeypatch.delenv("COACHING_KNOWLEDGE_FILE")
        load_catalog.cache_clear()
