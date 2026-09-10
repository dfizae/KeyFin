import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { confirmBudget, createBudgetProposal, getBudget } from "@/features/budget/api/budget.api";
import { roomKeys } from "@/features/room/api/queries";
import type { KRW } from "@/lib/money";

export const budgetKeys = {
  all: ["budget"] as const,
  month: (month: string) => [...budgetKeys.all, "month", month] as const,
  proposal: (month: string) => [...budgetKeys.all, "proposal", month] as const,
};

export function budgetQueryOptions(month: string) {
  return queryOptions({
    queryKey: budgetKeys.month(month),
    queryFn: ({ signal }) => getBudget(month, signal),
    staleTime: 30_000,
  });
}

export function useBudget(month: string) {
  return useQuery(budgetQueryOptions(month));
}

/**
 * 제안은 한 달에 한 번 만들어지는 값이라 화면에 머무는 동안 다시 부르지 않는다.
 * 조회가 아니라 생성(POST)이라 재시도도 하지 않는다 — 실패하면 사용자가 [다시 시도] 를 누른다.
 */
export function budgetProposalQueryOptions(month: string) {
  return queryOptions({
    queryKey: budgetKeys.proposal(month),
    queryFn: ({ signal }) => createBudgetProposal(month, signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

export function useBudgetProposal(month: string) {
  return useQuery(budgetProposalQueryOptions(month));
}

export type ConfirmBudgetVariables = {
  /** "YYYYMM" */
  month: string;
  entries: { envelopeId: number; amount: KRW }[];
};

/** 승인 후에는 예산·방(벽 보드 잔액)이 모두 바뀌므로 해당 월 예산과 방을 무효화한다 (docs/api-guide.md §5) */
export function useConfirmBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, entries }: ConfirmBudgetVariables) => confirmBudget(month, entries),
    onSuccess: (_result, { month }) => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.month(month) });
      void queryClient.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}
