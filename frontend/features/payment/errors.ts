import { isApiError } from "@/api/error";

const SAVE_UNKNOWN_MESSAGE = "고정지출을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
const DELETE_UNKNOWN_MESSAGE = "고정지출을 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/**
 * 고정지출 저장·삭제 실패 문구 (FR-PAY-07).
 * PAYMENT 도메인 오류 code 는 아직 확인되지 않아(frontend-spec.md §6 미결 #4) 서버 message 를 쓰고 없으면 기본 문구다 (규칙 90).
 */
export function fixedExpenseSaveErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return SAVE_UNKNOWN_MESSAGE;
  return error.message;
}

export function fixedExpenseDeleteErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return DELETE_UNKNOWN_MESSAGE;
  return error.message;
}
