import { queryOptions } from "@tanstack/react-query";

import { getHomeSummary } from "@/features/account/api/account.api";

export const accountKeys = {
  all: ["account"] as const,
  homeSummary: () => [...accountKeys.all, "home-summary"] as const,
};

export function homeSummaryQueryOptions() {
  return queryOptions({
    queryKey: accountKeys.homeSummary(),
    queryFn: ({ signal }) => getHomeSummary(signal),
    staleTime: 30_000,
  });
}
