/**
 * 금융망 연결 계약 (docs/api-contract.md LINK, 2026-09-10 백엔드 자료).
 * 서버가 KeyFin 사용자 토큰으로 인증하고, 입력한 금융망 이메일로 회원을 조회해 userKey 를 서버에 보관한다.
 * userKey 는 응답에 없고 클라이언트가 보내지도 않는다.
 */
export type FinanceLinkRequest = { financeEmail: string };

/** GET /links/status. 미연결도 정상 상태라 200 + false 로 온다 */
export type FinanceStatusDto = { financeConnected: boolean };

export type FinanceLinkResponseDto = { connected: boolean };

/** 금융망 이메일 제한: 형식과 최대 100자 (COMMON_001 을 미리 막는다) */
export const FINANCE_EMAIL_MAX_LENGTH = 100;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canSubmitFinanceEmail(email: string): boolean {
  const trimmed = email.trim();
  return EMAIL.test(trimmed) && trimmed.length <= FINANCE_EMAIL_MAX_LENGTH;
}
