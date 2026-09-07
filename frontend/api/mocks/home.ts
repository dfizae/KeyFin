import type { HomeSummaryDto } from "@/features/account/model";

export const MOCK_LATENCY_MS = 400;

export const homeSummaryMock: HomeSummaryDto = {
  user: { name: "김재영" },
  unreadNotificationCount: 3,
  primaryAccount: {
    accountId: "acc_001",
    bankName: "하네스은행",
    alias: "생활비 통장",
    accountNumber: "110-123-456789",
    balance: "3469520",
  },
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
