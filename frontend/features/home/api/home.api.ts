import { API_BASE_URL, api } from "@/api/client";
import { homeSummaryMock, withMockLatency } from "@/api/mocks/home";
import { toHomeSummary, type HomeSummary, type HomeSummaryDto } from "@/features/home/model";

export const USE_MOCKS = API_BASE_URL === "";

export async function getHomeSummary(signal?: AbortSignal): Promise<HomeSummary> {
  if (USE_MOCKS) return toHomeSummary(await withMockLatency(homeSummaryMock, signal));
  const { data } = await api.get<HomeSummaryDto>("/home/summary", { signal });
  return toHomeSummary(data);
}
