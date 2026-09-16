import { NETWORK_ERROR_CODE, TIMEOUT_ERROR_CODE, isApiError } from "@/api/error";

const SAVE_UNKNOWN_MESSAGE = "고정지출을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
const DELETE_UNKNOWN_MESSAGE = "고정지출을 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/**
 * 고정지출 등록·수정·삭제 실패 문구 (docs/api-contract.md PAYMENT, FR-PAY-07).
 * 계약에 있는 code 는 화면 문구로 바꾸고, 정의가 없는 code 는 서버 message 를 쓴다 (규칙 90).
 */
const FIXED_EXPENSE_MESSAGES: Record<string, string> = {
  PAY_001: "이미 삭제됐거나 찾을 수 없는 고정지출이에요.",
  PAY_002: "카드사에서 관리하는 정기결제라 여기서는 바꿀 수 없어요. 카드사·서비스에서 바꾸면 다음에 반영돼요.",
  PAY_003: "같은 내용의 고정지출이 이미 등록돼 있어요.",
  PAY_004: "카드 대금은 청구서로 계산돼서 직접 등록할 수 없어요.",
  ACCOUNT_001: "출금 계좌를 찾을 수 없어요. 목록을 새로 불러왔으니 다시 골라 주세요.",
  ACCOUNT_002: "연결을 해제한 계좌는 출금 계좌로 쓸 수 없어요. 다른 계좌를 골라 주세요.",
  COMMON_001: "입력한 내용을 다시 확인해 주세요.",
};

function messageOf(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback;
  return FIXED_EXPENSE_MESSAGES[error.code] ?? (error.message !== "" ? error.message : fallback);
}

export function fixedExpenseSaveErrorMessage(error: unknown): string {
  return messageOf(error, SAVE_UNKNOWN_MESSAGE);
}

export function fixedExpenseDeleteErrorMessage(error: unknown): string {
  return messageOf(error, DELETE_UNKNOWN_MESSAGE);
}

/** 화면이 들고 있던 고정지출이 서버와 어긋난 오류(이미 삭제됨·동기화 항목). 목록·캘린더를 다시 받아야 풀린다 */
const STALE_FIXED_EXPENSE_CODES = ["PAY_001", "PAY_002"];

export function isStaleFixedExpenseError(error: unknown): boolean {
  return isApiError(error) && STALE_FIXED_EXPENSE_CODES.includes(error.code);
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
