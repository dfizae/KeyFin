import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budget/api/queries";
import type { Budget } from "@/features/budget/model";
import { roomKeys } from "@/features/room/api/queries";
import {
  classifyTransaction,
  getPendingTransactions,
  getSubcategories,
  getTransactions,
  type ClassifyInput,
} from "@/features/transaction/api/transaction.api";
import type { PendingTransactions, TransactionFilter } from "@/features/transaction/model";

export const transactionKeys = {
  all: ["transaction"] as const,
  pending: () => [...transactionKeys.all, "pending"] as const,
  subcategories: () => [...transactionKeys.all, "subcategories"] as const,
  list: (filter: TransactionFilter) => [...transactionKeys.all, "list", filter] as const,
  recent: (month: string) => [...transactionKeys.all, "recent", month] as const,
};

/** 계약 기본값(size 20)과 같다 */
const TRANSACTION_PAGE_SIZE = 20;

/** 자산 탭 "최근 거래 내역" 건수 (Pencil 자산관리 UjYhB) */
export const RECENT_TRANSACTION_COUNT = 3;

export function transactionListQueryOptions(filter: TransactionFilter) {
  return infiniteQueryOptions({
    queryKey: transactionKeys.list(filter),
    queryFn: ({ pageParam, signal }) => getTransactions(filter, { cursor: pageParam, size: TRANSACTION_PAGE_SIZE }, signal),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

/** 거래 내역(전체보기). 스크롤 끝에서 nextCursor 로 다음 쪽을 받는다 */
export function useTransactionList(filter: TransactionFilter) {
  return useInfiniteQuery(transactionListQueryOptions(filter));
}

export function recentTransactionsQueryOptions(month: string) {
  return queryOptions({
    queryKey: transactionKeys.recent(month),
    queryFn: ({ signal }) => getTransactions({ month }, { cursor: null, size: RECENT_TRANSACTION_COUNT }, signal),
    staleTime: 30_000,
  });
}

/** 자산 탭의 이번 달 최근 거래. 달이 막 바뀌어 이번 달 거래가 없으면 빈 목록이다 */
export function useRecentTransactions(month: string) {
  return useQuery(recentTransactionsQueryOptions(month));
}

export function pendingTransactionsQueryOptions() {
  return queryOptions({
    queryKey: transactionKeys.pending(),
    queryFn: ({ signal }) => getPendingTransactions(signal),
    staleTime: 30_000,
  });
}

export function subcategoriesQueryOptions() {
  return queryOptions({
    queryKey: transactionKeys.subcategories(),
    queryFn: ({ signal }) => getSubcategories(signal),
    staleTime: 24 * 60 * 60_000,
  });
}

export function usePendingTransactions() {
  return useQuery(pendingTransactionsQueryOptions());
}

export function useSubcategories(enabled = true) {
  return useQuery({ ...subcategoriesQueryOptions(), enabled });
}

export type ClassifyVariables = ClassifyInput & {
  /** 거래가 속한 "YYYYMM" — 예산 캐시 갱신용 */
  monthKey: string;
};

/** 확정 후: 미확정 목록에서 빼고, 응답 봉투 잔액을 예산 캐시에 바로 쓴 뒤 관련 조회를 무효화한다 (docs/api-guide.md §5) */
export function useClassifyTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, request }: ClassifyVariables) => classifyTransaction({ transactionId, request }),
    onSuccess: (result, { transactionId, monthKey }) => {
      queryClient.setQueryData<PendingTransactions>(transactionKeys.pending(), (old) =>
        old ? { ...old, items: old.items.filter((item) => item.id !== transactionId) } : old
      );
      queryClient.setQueryData<Budget>(budgetKeys.month(monthKey), (old) =>
        old
          ? {
              ...old,
              envelopes: old.envelopes.map((envelope) =>
                envelope.envelopeId === result.envelopeId ? { ...envelope, remaining: result.remaining } : envelope
              ),
            }
          : old
      );
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.month(monthKey) });
      void queryClient.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}
