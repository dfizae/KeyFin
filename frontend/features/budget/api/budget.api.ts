import { USE_MOCKS, api } from "@/api/client";
import { budgetMock } from "@/api/mocks/budget";
import { withMockLatency } from "@/api/mocks/latency";
import { toBudget, type Budget, type BudgetDto } from "@/features/budget/model";

/** GET /budgets/{month} — 월 예산과 전체·봉투별 잔액 (docs/api-contract.md BUDGET, FR-BGT-03·04). month 는 "YYYYMM". */
export async function getBudget(month: string, signal?: AbortSignal): Promise<Budget> {
  if (USE_MOCKS) return toBudget(await withMockLatency(budgetMock(month), signal));
  const { data } = await api.get<BudgetDto>(`/budgets/${month}`, { signal });
  return toBudget(data);
}
