import { ApiError } from "@/api/error";
import type { FinanceLinkRequest, FinanceLinkResponseDto, FinanceStatusDto } from "@/features/link/model";

/**
 * 목 규칙: 금융망에 있는 이메일만 연결된다.
 * 서버 없이도 성공·없는 회원·중복 연결 세 경우를 모두 확인하려고 둔 값이다.
 */
export const MOCK_FINANCE_EMAIL = "finance@qwer.com";
/** 다른 KeyFin 계정이 이미 쓰고 있는 금융망 계정 (LINK_001) */
export const MOCK_TAKEN_FINANCE_EMAIL = "taken@qwer.com";

/** 앱이 도는 동안만 유지되는 연결 상태. 서버의 users.fin_user_key 자리를 대신한다 */
let connected = false;

export function financeStatusMock(): FinanceStatusDto {
  return { financeConnected: connected };
}

/** 테스트·개발 재시작용 */
export function resetLinkMocks(): void {
  connected = false;
}

export function connectFinanceMock({ financeEmail }: FinanceLinkRequest): FinanceLinkResponseDto {
  const email = financeEmail.trim().toLowerCase();
  if (email === MOCK_TAKEN_FINANCE_EMAIL) {
    throw new ApiError(409, "LINK_001", "해당 금융망 사용자는 이미 다른 계정과 연결되어 있습니다.");
  }
  if (email !== MOCK_FINANCE_EMAIL) {
    throw new ApiError(404, "FINANCE_001", "금융망에서 일치하는 사용자를 찾을 수 없습니다.");
  }
  connected = true;
  return { connected: true };
}
