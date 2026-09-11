import { USE_MOCKS, api } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";

/**
 * PUT /accounts/{id}/income — 수입 계좌 지정 (FR-USR-03). 200, 본문 없음.
 * 사용자당 1개라 기존 수입 계좌는 서버가 해제한다. ACCOUNT 명세가 아직 미완성이라 임시 계약이다 (docs/api-contract.md ACCOUNT, TBD).
 */
export async function setIncomeAccount(accountId: number): Promise<void> {
  if (USE_MOCKS) {
    // 지정 결과를 돌려줄 GET /accounts 가 아직 없어 목은 본문 없는 성공만 흉내 낸다
    await withMockLatency(undefined);
    return;
  }
  await api.put(`/accounts/${accountId}/income`);
}
