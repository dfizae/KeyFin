"""Measure returned approved evidence and explicit sums, not real-world prediction accuracy."""

from benchmarks.coaching.knowledge_response.cases import Case
from coaching_service.chat_answers import ChatAnswer
from coaching_service.schemas import JsonDocument


def reference_ids(answer: ChatAnswer) -> tuple[str, ...]:
    raw = answer.evidence.root.get("references")
    if not isinstance(raw, list):
        return ()
    return tuple(
        identifier for item in raw if isinstance(item, dict) and isinstance(identifier := item.get("id"), str)
    )


def evaluate(case: Case, response: JsonDocument) -> bool:
    if "answer_type" not in response.root:
        return False
    answer = ChatAnswer.model_validate(response.root)
    if answer.status != case.expected_status:
        return False
    if case.reference_id is not None:
        return (
            answer.answer_type == "finance_education"
            and answer.wording_source == "llm"
            and answer.fallback_reason is None
            and case.reference_id in reference_ids(answer)
        )
    if case.personal_topic is not None:
        if case.expected_status != "answered":
            return (
                answer.answer_type == "personal_context"
                and answer.wording_source == "engine"
                and answer.evidence.root.get("total_krw") is None
            )
        expected_rows = [150000, 250000] if case.personal_topic == "goals" else None
        rows = answer.evidence.root.get("rows")
        goals = expected_rows is None or (
            isinstance(rows, list)
            and [row.get("amount_krw") for row in rows if isinstance(row, dict)] == expected_rows
        )
        return (
            answer.answer_type == "personal_context"
            and answer.wording_source == "engine"
            and answer.evidence.root.get("topic") == case.personal_topic
            and answer.evidence.root.get("total_krw") == case.total_krw
            and goals
        )
    return (
        answer.answer_type == "scope_response"
        if case.expected_status == "out_of_scope"
        else answer.answer_type == "finance_education" and answer.wording_source == "llm"
    )
