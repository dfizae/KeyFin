import { isApiError } from "@/api/error";

const UNKNOWN_MESSAGE = "설정을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/**
 * 이체 설정 저장(PUT /settings/transfer) 실패 문구.
 * USER_005(한도 0 이하·1회 > 1일)는 화면 검사가 먼저 막으므로 넘어온 오류는 서버 message 를 쓰고 없으면 기본 문구다 (규칙 90).
 */
export function transferSettingsErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return UNKNOWN_MESSAGE;
  return error.message;
}
