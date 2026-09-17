import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";

import { COIN_HISTORY_PAGE_SIZE, getCoinBalance, getCoinHistory } from "@/features/shop/api/shop.api";
import type { CoinHistoryItem, CoinHistoryPage } from "@/features/shop/model";

export const shopKeys = {
  all: ["shop"] as const,
  /** 코인 잔액·이력. 출석처럼 코인이 바뀌면 이 프리픽스로 함께 무효화한다 */
  coins: () => [...shopKeys.all, "coins"] as const,
  coinBalance: () => [...shopKeys.coins(), "balance"] as const,
  coinHistory: () => [...shopKeys.coins(), "history"] as const,
};

export function coinBalanceQueryOptions() {
  return queryOptions({
    queryKey: shopKeys.coinBalance(),
    queryFn: ({ signal }) => getCoinBalance(signal),
    staleTime: 30_000,
  });
}

export function useCoinBalance() {
  return useQuery(coinBalanceQueryOptions());
}

export function coinHistoryQueryOptions() {
  return infiniteQueryOptions({
    queryKey: shopKeys.coinHistory(),
    queryFn: ({ pageParam, signal }) => getCoinHistory({ cursor: pageParam, size: COIN_HISTORY_PAGE_SIZE }, signal),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

/** 코인 이력(PAGE-30). 스크롤 끝에서 nextCursor 로 다음 쪽을 받는다 */
export function useCoinHistory() {
  return useInfiniteQuery(coinHistoryQueryOptions());
}

/** 받아 둔 쪽들을 한 목록으로 */
export function flattenCoinHistory(data: InfiniteData<CoinHistoryPage> | undefined): CoinHistoryItem[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}
