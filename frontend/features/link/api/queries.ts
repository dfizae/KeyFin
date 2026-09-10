import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { selectAuthStatus, useAuthStore } from "@/features/auth/store";
import { connectFinanceAccount, getFinanceStatus } from "@/features/link/api/link.api";
import type { FinanceLinkRequest } from "@/features/link/model";

export const linkKeys = {
  all: ["link"] as const,
  financeStatus: () => [...linkKeys.all, "finance-status"] as const,
};

/** 연결 상태는 서버가 가진 값이라 로그인해 있는 동안만 조회한다. 온보딩 분기의 근거라 자주 다시 부르지 않는다. */
export function financeStatusQueryOptions() {
  return queryOptions({
    queryKey: linkKeys.financeStatus(),
    queryFn: ({ signal }) => getFinanceStatus(signal),
    staleTime: 5 * 60_000,
  });
}

export function useFinanceStatus() {
  const authStatus = useAuthStore(selectAuthStatus);
  return useQuery({ ...financeStatusQueryOptions(), enabled: authStatus === "authenticated" });
}

/** 연결에 성공하면 상태 조회를 다시 하지 않고 캐시에 바로 반영한다 (docs/api-guide.md §5) */
export function useConnectFinance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: FinanceLinkRequest) => connectFinanceAccount(request),
    onSuccess: (connected) => {
      if (connected) queryClient.setQueryData(linkKeys.financeStatus(), true);
    },
  });
}
