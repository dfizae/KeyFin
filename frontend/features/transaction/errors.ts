import { isApiError } from "@/api/error";

export const CLASSIFY_ERROR_MESSAGE = "분류를 저장하지 못했어요. 다시 시도해 주세요.";

/**
 * 분류 확정(PUT /transactions/{id}/classification) 실패 문구 (FR-TXN-03, 백엔드 develop 2026-09-15 TransactionErrorCode).
 * 정의가 없는 code 는 서버 message 를 쓴다 (규칙 90).
 */
const CLASSIFY_MESSAGES: Record<string, string> = {
  TRANSACTION_004: "거래를 찾을 수 없어요. 목록을 새로 불러온 뒤 다시 골라 주세요.",
  TRANSACTION_005: "고른 세분류를 찾을 수 없어요. 다른 세분류를 골라 주세요.",
  TRANSACTION_006: "이 거래에는 쓸 수 없는 분류예요.",
  TRANSACTION_007: "입금이나 취소된 결제는 분류할 수 없어요.",
  TRANSACTION_008: "더치페이 부담액은 1원 이상, 결제 금액 이하여야 해요.",
};

export function classifyErrorMessage(error: unknown): string {
  if (!isApiError(error)) return CLASSIFY_ERROR_MESSAGE;
  return CLASSIFY_MESSAGES[error.code] ?? (error.message !== "" ? error.message : CLASSIFY_ERROR_MESSAGE);
}
