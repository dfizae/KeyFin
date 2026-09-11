import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setIncomeAccount } from "@/features/account/api/account.api";

export const accountKeys = {
  all: ["account"] as const,
};

/** 수입 계좌 지정. 성공하면 계좌 캐시를 무효화한다 (docs/api-guide.md §5). 금융망 후보에는 수입 여부가 없어 건드리지 않는다 */
export function useSetIncomeAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: number) => setIncomeAccount(accountId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
