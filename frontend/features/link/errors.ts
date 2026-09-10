import { isApiError } from "@/api/error";

/**
 * 금융망 연결 오류 문구 (docs/api-contract.md §3-0).
 * 정의가 없는 code 는 서버 message 를 그대로 쓴다 (규칙 90).
 */
const FINANCE_MESSAGES: Record<string, string> = {
  FINANCE_001: "그 이메일로 가입된 금융망 회원이 없어요. 금융망에 가입한 이메일이 맞는지 확인해 주세요.",
  FINANCE_002: "금융망 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
  FINANCE_003: "금융망 연동 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
  FINANCE_004: "금융망이 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.",
  LINK_001: "그 금융망 계정은 이미 다른 KeyFin 계정과 연결돼 있어요.",
  USER_004: "이미 다른 금융망 계정과 연결돼 있어요.",
  USER_001: "사용자 정보를 찾을 수 없어요. 다시 로그인해 주세요.",
  COMMON_001: "이메일 형식을 다시 확인해 주세요.",
  COMMON_002: "요청을 처리하지 못했어요. 다시 시도해 주세요.",
};

const UNKNOWN_MESSAGE = "금융망에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 다시 눌러도 결과가 같은 오류. 재시도 안내를 붙이지 않는다 */
const NOT_RETRYABLE = ["LINK_001", "USER_004", "FINANCE_001"];

export function financeErrorMessage(error: unknown): string {
  if (!isApiError(error)) return UNKNOWN_MESSAGE;
  return FINANCE_MESSAGES[error.code] ?? (error.message !== "" ? error.message : UNKNOWN_MESSAGE);
}

export function isRetryableFinanceError(error: unknown): boolean {
  return isApiError(error) ? !NOT_RETRYABLE.includes(error.code) : true;
}

const LINK_UNKNOWN_MESSAGE = "자산을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * POST /links 실패 문구. 계약에 이 엔드포인트의 code 목록이 아직 없어(docs/api-contract.md LINK)
 * 금융망 조회가 그대로 실패하는 경우를 같은 표에서 찾고, 없으면 서버 message 를 쓴다 (규칙 90).
 */
export function linkErrorMessage(error: unknown): string {
  if (!isApiError(error)) return LINK_UNKNOWN_MESSAGE;
  return FINANCE_MESSAGES[error.code] ?? (error.message !== "" ? error.message : LINK_UNKNOWN_MESSAGE);
}
