import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { selectAuthStatus, useAuthStore } from "@/features/auth/store";
import { connectFinanceAccount, createLinks, getFinanceStatus, getLinkCandidates } from "@/features/link/api/link.api";
import { isStaleCandidateError, needsFinanceReconnect } from "@/features/link/errors";
import type { FinanceLinkRequest, LinkRequest } from "@/features/link/model";

export const linkKeys = {
  all: ["link"] as const,
  financeStatus: () => [...linkKeys.all, "finance-status"] as const,
  candidates: () => [...linkKeys.all, "candidates"] as const,
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

/** 금융망 재연결이 필요한 오류는 다시 받아도 같으므로 재시도하지 않는다 */
const MAX_CANDIDATES_RETRY = 1;

/** 후보는 금융망 조회 결과라 화면에 들어올 때마다 새로 받는다. 연결 뒤에는 목록의 linked 가 바뀌어야 한다 */
export function useLinkCandidates() {
  const authStatus = useAuthStore(selectAuthStatus);
  return useQuery({
    queryKey: linkKeys.candidates(),
    queryFn: ({ signal }) => getLinkCandidates(signal),
    enabled: authStatus === "authenticated",
    staleTime: 0,
    retry: (failureCount, error) => !needsFinanceReconnect(error) && failureCount < MAX_CANDIDATES_RETRY,
  });
}

/**
 * 연결 성공 후 후보 목록을 무효화해 linked 상태를 서버 기준으로 다시 받는다 (docs/api-guide.md §5).
 * 고른 항목이 후보에서 사라졌다는 오류(LINK_004·LINK_005)도 서버 안내대로 목록을 다시 받는다.
 */
export function useCreateLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: LinkRequest) => createLinks(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: linkKeys.candidates() }),
    onError: (error) => {
      if (isStaleCandidateError(error)) void queryClient.invalidateQueries({ queryKey: linkKeys.candidates() });
    },
  });
}
