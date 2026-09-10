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
 * POST /budgets/proposals — 월 예산 제안 생성 (FR-USR-04, FR-BGT-01).
 * 온보딩에서는 PAGE-06 이 만들고 PAGE-07 이 보여주는 순서지만, PAGE-06 이 없는 동안은 승인 화면이 직접 호출한다.
 * 같은 달을 두 번 호출했을 때 서버가 기존 제안을 돌려주는지(멱등) 백엔드 확인 필요. (TBD)
 */
export async function createBudgetProposal(month: string, signal?: AbortSignal): Promise<BudgetProposal> {
  if (USE_MOCKS) return toBudgetProposal(await withMockLatency(budgetProposalMock(month), signal));
  const { data } = await api.post<BudgetProposalDto>("/budgets/proposals", { month }, { signal });
  return toBudgetProposal(data);
}

/** PUT /budgets/{month}/confirm — 봉투 7개 금액을 확정한다 (FR-BGT-02). */
export async function confirmBudget(month: string, entries: { envelopeId: number; amount: KRW }[]): Promise<void> {
  if (USE_MOCKS) {
    await withMockLatency(confirmBudgetMock());
    return;
  }
  await api.put<ConfirmBudgetResponseDto>(`/budgets/${month}/confirm`, toConfirmRequest(entries));
}
