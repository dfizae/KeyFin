import { queryOptions } from "@tanstack/react-query";

import { getHomeSummary } from "@/features/home/api/home.api";

export const homeKeys = {
  all: ["home"] as const,
  summary: () => [...homeKeys.all, "summary"] as const,
};

export function homeSummaryQueryOptions() {
  return queryOptions({
    queryKey: homeKeys.summary(),
    queryFn: ({ signal }) => getHomeSummary(signal),
    staleTime: 30_000,
  });
}
