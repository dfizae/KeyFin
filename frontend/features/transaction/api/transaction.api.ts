import { USE_MOCKS, api } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { classifyTransactionMock, pendingTransactionsMock, subcategoriesMock } from "@/api/mocks/transaction";
import {
  toClassifyResult,
  toPendingTransactions,
  toSubcategories,
  type ClassifyRequest,
  type ClassifyResponseDto,
  type ClassifyResult,
  type PendingTransactions,
  type PendingTransactionsDto,
  type Subcategory,
  type SubcategoryListDto,
} from "@/features/transaction/model";

/** GET /transactions/pending — 사용자 확인이 필요한 미확정 거래 (FR-TXN-03). 파라미터 없음 */
export async function getPendingTransactions(signal?: AbortSignal): Promise<PendingTransactions> {
  if (USE_MOCKS) return toPendingTransactions(await withMockLatency(pendingTransactionsMock(), signal));
  const { data } = await api.get<PendingTransactionsDto>("/transactions/pending", { signal });
  return toPendingTransactions(data);
}

/** GET /subcategories — 정적 세분류 22종 */
export async function getSubcategories(signal?: AbortSignal): Promise<Subcategory[]> {
  if (USE_MOCKS) return toSubcategories(await withMockLatency(subcategoriesMock, signal));
  const { data } = await api.get<SubcategoryListDto>("/subcategories", { signal });
  return toSubcategories(data);
}

export type ClassifyInput = { transactionId: number; request: ClassifyRequest };

/** PUT /transactions/{id}/classification — 세분류 확정 또는 제외 태그. 응답의 봉투 잔액으로 보드를 즉시 갱신한다 */
export async function classifyTransaction({ transactionId, request }: ClassifyInput): Promise<ClassifyResult> {
  if (USE_MOCKS) return toClassifyResult(await withMockLatency(classifyTransactionMock(transactionId, request)));
  const { data } = await api.put<ClassifyResponseDto>(`/transactions/${transactionId}/classification`, request);
  return toClassifyResult(data);
}
