"""개인 질문은 계산 가능한 범위를 명확히 고른 뒤 서버가 그대로 집계한다."""

import re
from typing import Final

from coaching_service.personal_contract import PersonalTopic

_TOPICS: Final[dict[str, PersonalTopic]] = {
    "계좌잔액": "accounts",
    "통장잔액": "accounts",
    "계좌": "accounts",
    "잔액": "accounts",
    "자산": "assets",
    "부채": "debts",
    "대출잔액": "debts",
    "대출금": "debts",
    "보험": "insurance",
    "보험료": "insurance",
    "소득": "income",
    "월소득": "income",
    "월급": "income",
    "고정비": "fixed_costs",
    "월고정비": "fixed_costs",
    "예정결제": "payments",
    "예정결제금액": "payments",
    "금융목표": "goals",
    "목표": "goals",
}
_QUERY: Final = re.compile(
    r"(?:현재|지금)?(?:내|제|나의|저의)?(?:현재|지금)?(?:총|전체)?"
    rf"(?P<topic>{'|'.join(re.escape(name) for name in _TOPICS)})"
    r"(?:현황|내역|목록|총액|합계)?(?:은|는|이|가|을|를)?(?:좀)?"
    r"(?:얼마(?:야|인가요|예요|지|나돼)?|뭐(?:야|가있어)|어떻게돼|알려(?:줘|주세요)|"
    r"보여(?:줘|주세요)|조회해(?:줘|주세요)|확인해(?:줘|주세요))?[?!.]*"
)


def select_personal_topic(question: str) -> PersonalTopic | None:
    """조건의 일부만 잡아 은행·기간·비교 필터를 조용히 무시하지 않는다."""
    matched = _QUERY.fullmatch(re.sub(r"\s+", "", question))
    return _TOPICS[matched["topic"]] if matched is not None else None
