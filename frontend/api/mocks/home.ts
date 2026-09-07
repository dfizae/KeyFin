import type { HomeSummaryDto } from "@/features/home/model";

export const MOCK_LATENCY_MS = 400;

/** Pencil 홈(캐릭터 활성화) zq2Xl 의 값과 같다: 코인 1,250 · 남은 예산 180,000원(총 500,000 중 320,000 사용) · 배지 3 */
export const homeSummaryMock: HomeSummaryDto = {
  user: { name: "김재영" },
  unreadNotificationCount: 3,
  coinBalance: 1250,
  character: { characterId: "chr_001", name: "키핀" },
  monthlyBudget: { total: "500000", spent: "320000" },
};

export function withMockLatency<T>(value: T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), MOCK_LATENCY_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("요청이 취소되었습니다", "AbortError"));
    });
  });
}
