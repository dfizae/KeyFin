"""Bounded lexical retrieval of approved concepts, separate from model selection.

Aliases describe subjects, never fixed benchmark answers. Explicit current-question
terms outrank prior context; only an anaphoric follow-up may reuse the last user topic.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from coaching_service.knowledge_catalog import KnowledgeCatalog, KnowledgeFact, load_catalog

if TYPE_CHECKING:
    from coaching_service.llm_contract import ChatMessage

_FOLLOWUP = re.compile(
    r"(?:(?:그럼|그러면)\s*)?(?:(?:그거|그것|이것)(?:은|는)?\s*)?"
    r"(?:(?:좀|조금)\s*)?(?:더\s*)?(?:(?:자세히|자세하게|상세히)\s*)?"
    r"(?:설명해\s*(?:줘|주세요)|알려\s*(?:줘|주세요)|차이는|장단점은)[?!.]*"
)


def compact(text: str) -> str:
    return re.sub(r"[^a-z0-9가-힣]", "", unicodedata.normalize("NFKC", text).lower())


def is_followup(question: str) -> bool:
    return _FOLLOWUP.fullmatch(question.strip()) is not None


def term_score(question: str, fact: KnowledgeFact) -> int:
    normalized = compact(question)
    # Long subject names carry more information than a short generic word.
    return sum(min(len(term), 12) for alias in fact.aliases if (term := compact(alias)) in normalized)


def retrieve_facts(
    question: str,
    history: tuple[ChatMessage, ...] = (),
    *,
    catalog: KnowledgeCatalog | None = None,
    today: date | None = None,
) -> tuple[KnowledgeFact, ...]:
    """Return at most eight current, relevant records; missing coverage stays missing."""
    current = catalog or load_catalog()
    on_date = today or datetime.now(ZoneInfo("Asia/Seoul")).date()
    eligible = [fact for fact in current.facts if fact.reviewed_on <= on_date <= fact.review_due]
    query = question
    ranked = [(term_score(query, fact), index, fact) for index, fact in enumerate(eligible)]
    if not any(score for score, _, _ in ranked) and is_followup(question):
        previous = next((
            row.content for row in reversed(history) if row.role == "user" and not is_followup(row.content)
        ), "")
        query = previous + " " + question
        ranked = [(term_score(query, fact), index, fact) for index, fact in enumerate(eligible)]
    ranked.sort(key=lambda row: (-row[0], row[1]))
    return tuple(fact for score, _, fact in ranked[:8] if score > 0)
