import { queryOptions, useQuery } from "@tanstack/react-query";

import { getBudget } from "@/features/budget/api/budget.api";

export const budgetKeys = {
  all: ["budget"] as const,
  month: (month: string) => [...budgetKeys.all, "month", month] as const,
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
