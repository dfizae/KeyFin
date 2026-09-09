import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budget/api/queries";
import type { Budget } from "@/features/budget/model";
import { roomKeys } from "@/features/room/api/queries";
import { classifyTransaction, getPendingTransactions, getSubcategories, type ClassifyInput } from "@/features/transaction/api/transaction.api";
import type { PendingTransactions } from "@/features/transaction/model";

export const transactionKeys = {
  all: ["transaction"] as const,
  pending: () => [...transactionKeys.all, "pending"] as const,
  subcategories: () => [...transactionKeys.all, "subcategories"] as const,
};

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
