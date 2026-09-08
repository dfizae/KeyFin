import { queryOptions, useQuery } from "@tanstack/react-query";

import { getPaymentCalendar } from "@/features/payment/api/payment.api";

export const paymentKeys = {
  all: ["payment"] as const,
  /** 고정지출·이체 변경 시 달 구분 없이 무효화하는 키 (docs/api-guide.md §무효화) */
  calendar: () => [...paymentKeys.all, "calendar"] as const,
  calendarMonth: (month: string) => [...paymentKeys.calendar(), month] as const,
};

export function paymentCalendarQueryOptions(month: string) {
  return queryOptions({
    queryKey: paymentKeys.calendarMonth(month),
    queryFn: ({ signal }) => getPaymentCalendar(month, signal),
    staleTime: 30_000,
  });
}

export function usePaymentCalendar(month: string) {
  return useQuery(paymentCalendarQueryOptions(month));
}
