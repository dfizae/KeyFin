import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { selectAuthStatus, useAuthStore } from "@/features/auth/store";
import { getTransferSettings, updateTransferSettings } from "@/features/settings/api/settings.api";
import type { TransferSettings } from "@/features/settings/model";

export const settingsKeys = {
  all: ["settings"] as const,
  transfer: () => [...settingsKeys.all, "transfer"] as const,
};

export function transferSettingsQueryOptions() {
  return queryOptions({
    queryKey: settingsKeys.transfer(),
    queryFn: ({ signal }) => getTransferSettings(signal),
    staleTime: 60_000,
  });
}

export function useTransferSettings() {
  const authStatus = useAuthStore(selectAuthStatus);
  return useQuery({ ...transferSettingsQueryOptions(), enabled: authStatus === "authenticated" });
}

/**
 * 저장 응답이 곧 새 설정이라 캐시에 바로 쓴다 (docs/api-guide.md §5).
 * 돈이 움직이는 설정이라 자동 재시도는 하지 않는다 — 실패는 화면이 문구와 재시도 수단으로 알린다 (규칙 80).
 */
export function useUpdateTransferSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTransferSettings,
    retry: false,
    onSuccess: (settings) => queryClient.setQueryData<TransferSettings>(settingsKeys.transfer(), settings),
  });
}
