import { api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { coinBalanceMock, coinHistoryMock } from "@/api/mocks/shop";
import {
  toCoinBalance,
  toCoinHistoryPage,
  type CoinBalanceDto,
  type CoinHistoryDto,
  type CoinHistoryPage,
} from "@/features/shop/model";

export type CoinHistoryPageParams = { cursor: number | null; size: number };

/** 계약 기본값(size 20)과 같다 */
export const COIN_HISTORY_PAGE_SIZE = 20;

/** GET /fin-coins?cursor=&size= — 코인 지급·사용 이력, 최신순 커서 페이지 (FR-GAM-08). 오류: 400 COMMON_001 · 404 USER_001 */
export async function getCoinHistory(page: CoinHistoryPageParams, signal?: AbortSignal): Promise<CoinHistoryPage> {
  if (isMocked("shop")) return toCoinHistoryPage(await withMockLatency(coinHistoryMock(page), signal));
  const { data } = await api.get<CoinHistoryDto>("/fin-coins", {
    params: { cursor: page.cursor ?? undefined, size: page.size },
    signal,
  });
  return toCoinHistoryPage(data);
}

/** GET /fin-coins/balance — 가장 최근 이력의 잔액. 이력이 없으면 0 */
export async function getCoinBalance(signal?: AbortSignal): Promise<number> {
  if (isMocked("shop")) return toCoinBalance(await withMockLatency(coinBalanceMock(), signal));
  const { data } = await api.get<CoinBalanceDto>("/fin-coins/balance", { signal });
  return toCoinBalance(data);
}
