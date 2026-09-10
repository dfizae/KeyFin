import { USE_MOCKS, api } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { connectFinanceMock, createLinksMock, financeStatusMock, linkCandidatesMock } from "@/api/mocks/link";
import {
  toLinkCandidates,
  type FinanceLinkRequest,
  type FinanceLinkResponseDto,
  type FinanceStatusDto,
  type LinkCandidates,
  type LinkCandidatesDto,
  type LinkRequest,
  type LinkResponseDto,
} from "@/features/link/model";

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

/**
 * GET /links/candidates — 금융망 기준 연결 가능한 계좌·카드 (docs/api-contract.md LINK, FR-USR-02).
 * 금융망 회원 연결(PAGE-03B)이 끝나야 후보가 돌아온다.
 */
export async function getLinkCandidates(signal?: AbortSignal): Promise<LinkCandidates> {
  if (USE_MOCKS) return toLinkCandidates(await withMockLatency(linkCandidatesMock(), signal));
  const { data } = await api.get<LinkCandidatesDto>("/links/candidates", { signal });
  return toLinkCandidates(data);
}

/** POST /links — 선택 항목 연결. 이미 연결된 항목은 서버가 무시하므로 재시도해도 안전하다(멱등) */
export async function createLinks(request: LinkRequest): Promise<LinkResponseDto> {
  if (USE_MOCKS) return withMockLatency(createLinksMock(request));
  const { data } = await api.post<LinkResponseDto>("/links", request);
  return data;
}
