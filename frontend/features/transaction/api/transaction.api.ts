import { USE_MOCKS, api } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { classifyTransactionMock, pendingTransactionsMock, subcategoriesMock, transactionListMock } from "@/api/mocks/transaction";
import {
  toClassifyResult,
  toPendingTransactions,
  toSubcategories,
  toTransactionPage,
  type ClassifyRequest,
  type ClassifyResponseDto,
  type ClassifyResult,
  type PendingTransactions,
  type PendingTransactionsDto,
  type Subcategory,
  type SubcategoryListDto,
  type TransactionFilter,
  type TransactionListDto,
  type TransactionPage,
} from "@/features/transaction/model";
import { currentDateKey } from "@/lib/date";

export type TransactionPageParams = { cursor: number | null; size: number };

/**
 * GET /transactions — 월 거래 목록, 커서 페이지 (FR-TXN-09). 취소·예산 제외 거래도 온다.
 * 백엔드 미구현이라 계약 사본(노션 9/8) 기준 목으로만 동작한다. Swagger 가 오면 파라미터·응답을 다시 맞춘다 (TBD)
 */
export async function getTransactions(
  filter: TransactionFilter,
  { cursor, size }: TransactionPageParams,
  signal?: AbortSignal
): Promise<TransactionPage> {
  const params = { ...filter, cursor: cursor ?? undefined, size };
  if (USE_MOCKS) return toTransactionPage(await withMockLatency(transactionListMock(params, currentDateKey()), signal));
  const { data } = await api.get<TransactionListDto>("/transactions", { params, signal });
  return toTransactionPage(data);
}

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
