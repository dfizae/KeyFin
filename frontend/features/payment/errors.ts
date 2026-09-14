import { NETWORK_ERROR_CODE, TIMEOUT_ERROR_CODE, isApiError } from "@/api/error";

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

const TRANSFER_UNKNOWN_MESSAGE = "이체를 실행하지 못했어요. 상태를 다시 확인해 주세요.";
const TRANSFER_UNCONFIRMED_MESSAGE = "연결이 끊겨 이체가 됐는지 확인하지 못했어요. 상태를 새로 고쳐 결과를 확인해 주세요.";
const POSTPONE_UNKNOWN_MESSAGE = "나중에로 미루지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/**
 * 네트워크·타임아웃은 이체가 됐는지 모르는 상태다. 다시 보내지 않고 서버 상태 조회로 확정한다 (규칙 80).
 */
export function isUnconfirmedTransferError(error: unknown): boolean {
  return isApiError(error) && (error.code === NETWORK_ERROR_CODE || error.code === TIMEOUT_ERROR_CODE);
}

export function transferApproveErrorMessage(error: unknown): string {
  if (isUnconfirmedTransferError(error)) return TRANSFER_UNCONFIRMED_MESSAGE;
  if (!isApiError(error) || error.message === "") return TRANSFER_UNKNOWN_MESSAGE;
  return error.message;
}

export function transferPostponeErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return POSTPONE_UNKNOWN_MESSAGE;
  return error.message;
}
