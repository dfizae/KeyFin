import { infiniteQueryOptions, type QueryCache, queryOptions, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { budgetKeys } from "@/features/budget/api/queries";
import { isWithinPeriod, type Budget } from "@/features/budget/model";
import { roomKeys } from "@/features/room/api/queries";
import {
  classifyTransaction,
  getPendingTransactions,
  getSubcategories,
  getTransactions,
  type ClassifyInput,
} from "@/features/transaction/api/transaction.api";
import type { PendingTransactions, Transaction, TransactionFilter } from "@/features/transaction/model";

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

/**
 * 거래 내역(전체보기·봉투 상세). 스크롤 끝에서 nextCursor 로 다음 쪽을 받는다.
 * enabled 는 필터 값이 아직 없을 때(봉투 상세가 예산 주기를 기다릴 때) 첫 요청을 미루는 용도다.
 */
export function useTransactionList(filter: TransactionFilter, enabled = true) {
  return useInfiniteQuery({ ...transactionListQueryOptions(filter), enabled });
}

/** 거래 한 건이 담겨 있을 수 있는 캐시: 목록(커서 페이지)·자산 탭 최근 거래·미확정 목록 */
const CACHED_TRANSACTION_PREFIXES = [
  [...transactionKeys.all, "list"],
  [...transactionKeys.all, "recent"],
  transactionKeys.pending(),
] as const;

/** 한 쪽(page) 모양만 좁힌다. 커서 페이지 캐시는 `pages`, 단일 조회 캐시는 그 자체가 한 쪽이다 */
function cachedPages(data: unknown): readonly { items: Transaction[] }[] {
  if (data === null || typeof data !== "object") return [];
  const cached = data as { items?: unknown; pages?: unknown };
  if (Array.isArray(cached.pages)) return cached.pages as { items: Transaction[] }[];
  if (Array.isArray(cached.items)) return [data as { items: Transaction[] }];
  return [];
}

function findCachedTransaction(cache: QueryCache, transactionId: number): Transaction | null {
  for (const prefix of CACHED_TRANSACTION_PREFIXES) {
    for (const query of cache.findAll({ queryKey: prefix })) {
      for (const page of cachedPages(query.state.data)) {
        const found = page.items.find((transaction) => transaction.id === transactionId);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * 거래 상세(PAGE-21)가 보여 줄 거래 한 건. 거래 단건 조회 API 가 계약에 없어(docs/api-contract.md TRANSACTION)
 * 화면이 들어온 목록 캐시에서 찾고, 분류를 바꿔 목록이 갱신되면 상세도 같이 바뀌도록 쿼리 캐시를 구독한다.
 * 캐시에 없으면(딥링크·앱 재시작) null 이고 화면이 목록으로 보낸다.
 */
export function useCachedTransaction(transactionId: number | null): Transaction | null {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((onStoreChange: () => void) => cache.subscribe(onStoreChange), [cache]);
  return useSyncExternalStore(subscribe, () =>
    transactionId === null ? null : findCachedTransaction(cache, transactionId)
  );
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
  /** 거래일 "YYYY-MM-DD" — 현재 주기 예산 캐시에 바로 반영해도 되는지 가른다 */
  txDate: string;
};

/**
 * 확정 후: 미확정 목록에서 빼고, 거래가 현재 주기 안이면 응답 봉투 잔액을 예산 캐시에 바로 쓴 뒤 관련 조회를 무효화한다
 * (docs/api-guide.md §5). 지난 주기 거래면 현재 주기 잔액과 무관하니 캐시를 건드리지 않는다.
 */
export function useClassifyTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, request }: ClassifyVariables) => classifyTransaction({ transactionId, request }),
    onSuccess: (result, { transactionId, txDate }) => {
      queryClient.setQueryData<PendingTransactions>(transactionKeys.pending(), (old) =>
        old ? { ...old, items: old.items.filter((item) => item.id !== transactionId) } : old
      );
      queryClient.setQueryData<Budget>(budgetKeys.current(), (old) =>
        old && isWithinPeriod(old, txDate)
          ? {
              ...old,
              envelopes: old.envelopes.map((envelope) =>
                envelope.envelopeId === result.envelopeId ? { ...envelope, remaining: result.remaining } : envelope
              ),
            }
          : old
      );
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.current() });
      void queryClient.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}
