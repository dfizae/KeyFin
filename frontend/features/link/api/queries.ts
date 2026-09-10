import { useMutation } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store";
import { connectFinanceAccount } from "@/features/link/api/link.api";
import type { FinanceLinkRequest } from "@/features/link/model";
import { saveFinanceLinked } from "@/lib/session-storage";

/**
 * 연결 성공 여부는 서버가 가진 상태지만 조회 API 가 없어 기기에도 남긴다.
 * 상태 조회 엔드포인트가 생기면 이 로컬 기록을 걷어낸다. (TBD)
 */
export function useConnectFinance() {
  const user = useAuthStore((state) => state.user);
  const markFinanceLinked = useAuthStore((state) => state.markFinanceLinked);

  return useMutation({
    mutationFn: (request: FinanceLinkRequest) => connectFinanceAccount(request),
    onSuccess: async (connected) => {
      if (!connected || user === null) return;
      await saveFinanceLinked(user.id);
      markFinanceLinked();
    },
  });
}
