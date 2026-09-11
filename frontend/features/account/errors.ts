import { isApiError } from "@/api/error";

const INCOME_UNKNOWN_MESSAGE = "수입 계좌를 지정하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** PUT /accounts/{id}/income 실패 문구. ACCOUNT 오류 code 가 아직 명세에 없어 서버 message 를 쓴다 (규칙 90, TBD) */
export function incomeAccountErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return INCOME_UNKNOWN_MESSAGE;
  return error.message;
}
