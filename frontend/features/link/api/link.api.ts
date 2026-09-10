import { USE_MOCKS, api } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { connectFinanceMock, financeStatusMock } from "@/api/mocks/link";
import type { FinanceLinkRequest, FinanceLinkResponseDto, FinanceStatusDto } from "@/features/link/model";

/** GET /links/status — 현재 사용자의 금융망 연결 여부 (docs/api-contract.md LINK). 미연결도 200 + false 다. */
export async function getFinanceStatus(signal?: AbortSignal): Promise<boolean> {
  if (USE_MOCKS) {
    const { financeConnected } = await withMockLatency(financeStatusMock(), signal);
    return financeConnected;
  }
  const { data } = await api.get<FinanceStatusDto>("/links/status", { signal });
  return data.financeConnected;
}

/**
 * 금융망 회원 연결. Bearer 필요.
 * ⚠️ URL 과 메서드가 백엔드 자료에 없어 아직 확정되지 않았다. 목으로만 동작하며 실서버를 붙이기 전에 반드시 확인한다. (TBD)
 */
const FINANCE_LINK_URL = "/links/finance";

export async function connectFinanceAccount(request: FinanceLinkRequest): Promise<boolean> {
  if (USE_MOCKS) {
    const { connected } = await withMockLatency(connectFinanceMock(request));
    return connected;
  }
  const { data } = await api.post<FinanceLinkResponseDto>(FINANCE_LINK_URL, request);
  return data.connected;
}
