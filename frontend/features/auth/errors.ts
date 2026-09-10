import { isApiError } from "@/api/error";

/**
 * 확인된 code 만 문구를 정의하고 나머지는 서버 message 를 그대로 쓴다 (규칙 90).
 * 백엔드가 이미 사용자 문구로 내려주므로 여기 있는 값은 표현을 다듬는 용도다.
 */
const AUTH_MESSAGES: Record<string, string> = {
  AUTH_001: "이메일 또는 비밀번호가 올바르지 않습니다.",
  AUTH_002: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  AUTH_004: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  USER_002: "이미 사용 중인 이메일입니다.",
  COMMON_001: "입력값을 다시 확인해 주세요.",
};

const UNKNOWN_MESSAGE = "로그인하지 못했어요. 잠시 후 다시 시도해 주세요.";

export function authErrorMessage(error: unknown): string {
  if (!isApiError(error)) return UNKNOWN_MESSAGE;
  return AUTH_MESSAGES[error.code] ?? (error.message !== "" ? error.message : UNKNOWN_MESSAGE);
}
