import { isApiError } from "@/api/error";

const PROPOSAL_UNKNOWN_MESSAGE = "잠시 후 다시 시도해 주세요.";

/** 예산 제안(POST /budgets/proposals) 실패 문구. 따로 정한 code 가 없어 서버 message 를 쓴다 (규칙 90) */
export function proposalErrorMessage(error: unknown): string {
  if (!isApiError(error) || error.message === "") return PROPOSAL_UNKNOWN_MESSAGE;
  return error.message;
}
