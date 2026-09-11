import { USE_MOCKS, api } from "@/api/client";
import { budgetMock, budgetProposalMock, confirmBudgetMock } from "@/api/mocks/budget";
import { withMockLatency } from "@/api/mocks/latency";
import {
  toBudget,
  toBudgetProposal,
  toConfirmRequest,
  type Budget,
  type BudgetDto,
  type BudgetProposal,
  type BudgetProposalDto,
  type ConfirmBudgetResponseDto,
} from "@/features/budget/model";
import type { KRW } from "@/lib/money";

/** GET /budgets/{month} — 월 예산과 전체·봉투별 잔액 (docs/api-contract.md BUDGET, FR-BGT-03·04). month 는 "YYYYMM". */
export async function getBudget(month: string, signal?: AbortSignal): Promise<Budget> {
  if (USE_MOCKS) return toBudget(await withMockLatency(budgetMock(month), signal));
  const { data } = await api.get<BudgetDto>(`/budgets/${month}`, { signal });
  return toBudget(data);
}

/**
 * POST /budgets/proposals — 예산 제안 생성 (FR-USR-04, FR-BGT-01). 요청 본문이 없다.
 * 대상 월은 서버가 요청 시점과 사용자의 예산 기준일로 정하고 응답 month 로 알려준다. month 인자는 캐시 키·목 전용이다.
 * ⚠️ 같은 달에 예산이 이미 있으면 409 BUDGET_001 이다(멱등 아님). 앱을 다시 켜서 또 부르면 제안을 받을 방법이 없어 백엔드에 요청 중 (TBD)
 */
export async function createBudgetProposal(month: string, signal?: AbortSignal): Promise<BudgetProposal> {
  if (USE_MOCKS) return toBudgetProposal(await withMockLatency(budgetProposalMock(month), signal));
  const { data } = await api.post<BudgetProposalDto>("/budgets/proposals", undefined, { signal });
  return toBudgetProposal(data);
}

/** PUT /budgets/{budgetId}/confirm — 제안의 budgetId 로 봉투 7개 금액을 확정한다 (FR-BGT-02). 금액은 1,000원 단위 */
export async function confirmBudget(budgetId: number, entries: { envelopeId: number; amount: KRW }[]): Promise<void> {
  if (USE_MOCKS) {
    await withMockLatency(confirmBudgetMock(budgetId));
    return;
  }
  await api.put<ConfirmBudgetResponseDto>(`/budgets/${budgetId}/confirm`, toConfirmRequest(entries));
}
