import { isApiError } from "@/api/error";

/** 코칭 서버 응답 없음(503). 서버 message "코치가 잠시 자리를 비웠어요. 잠시 후 다시 시도해 주세요." */
export const COACH_UNAVAILABLE_CODE = "AI_001";
export const CHAT_ERROR_MESSAGE = "답변을 받지 못했어요. 다시 시도해 주세요.";

/**
 * 코치 질문(POST /coaching/chat)·이력(GET) 실패 문구 (백엔드 develop CoachingErrorCode, 2026-09-22).
 * 정의가 없는 code 는 서버 message 를 쓴다 (규칙 90).
 */
const CHAT_MESSAGES: Record<string, string> = {
  [COACH_UNAVAILABLE_CODE]: "코치가 잠시 자리를 비웠어요. 잠시 후 다시 시도해 주세요.",
  COMMON_001: "질문은 1자 이상 2000자 이하로 적어 주세요.",
};

export function chatErrorMessage(error: unknown): string {
  if (!isApiError(error)) return CHAT_ERROR_MESSAGE;
  return CHAT_MESSAGES[error.code] ?? (error.message !== "" ? error.message : CHAT_ERROR_MESSAGE);
}

/** 코칭 서버가 자리를 비운 것이라 잠시 뒤 다시 시도할 수 있는 실패인지 */
export function isCoachUnavailable(error: unknown): boolean {
  return isApiError(error) && error.code === COACH_UNAVAILABLE_CODE;
}
