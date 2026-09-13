import { isApiError } from "@/api/error";

export const CLASSIFY_ERROR_MESSAGE = "분류를 저장하지 못했어요. 다시 시도해 주세요.";

/**
 * 분류 확정(PUT /transactions/{id}/classification) 실패 문구 (FR-TXN-03).
 * TRANSACTION 도메인 오류 code 는 아직 확인되지 않아(frontend-spec.md §6 미결 #4) 서버 message 를 쓰고 없으면 기본 문구다 (규칙 90).
 */
export function classifyErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return CLASSIFY_ERROR_MESSAGE;
  return error.message;
}
