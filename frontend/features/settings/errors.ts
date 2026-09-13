import { isApiError } from "@/api/error";

const UNKNOWN_MESSAGE = "설정을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/**
 * 이체 설정 저장(PUT /settings) 실패 문구.
 * USER 도메인에서 확인된 code 는 인증·중복 이메일뿐이라(frontend-spec.md §6 미결 #4) 서버 message 를 쓰고 없으면 기본 문구다 (규칙 90).
 */
export function transferSettingsErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return UNKNOWN_MESSAGE;
  return error.message;
}
