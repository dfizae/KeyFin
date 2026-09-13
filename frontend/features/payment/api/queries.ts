import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createFixedExpense,
  deleteFixedExpense,
  getPaymentCalendar,
  updateFixedExpense,
} from "@/features/payment/api/payment.api";
import type { CalendarEntry, PaymentCalendar } from "@/features/payment/model";
import { roomKeys } from "@/features/room/api/queries";

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

/**
 * 고정지출을 바꾸면 달 구분 없이 캘린더를 무효화한다(출금일을 옮기면 다른 달로 갈 수 있다).
 * 방 캘린더 에셋도 같은 조회를 쓰므로 방 쿼리까지 함께 무효화한다 (docs/api-guide.md §5).
 */
function useFixedExpenseMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.calendar() });
      void queryClient.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}

export function useCreateFixedExpense() {
  return useFixedExpenseMutation(createFixedExpense);
}

export function useUpdateFixedExpense() {
  return useFixedExpenseMutation(updateFixedExpense);
}

export function useDeleteFixedExpense() {
  return useFixedExpenseMutation(deleteFixedExpense);
}

/**
 * 고정지출 수정 화면(PAGE-26)의 폼 초기값. 단건 조회 API 가 계약에 없어(docs/api-contract.md PAYMENT)
 * 캘린더 캐시에서 그 고정지출의 항목을 찾는다. 캐시에 없으면(딥링크·앱 재시작) null 이고 화면이 캘린더로 보낸다.
 * 폼을 처음 채울 때만 읽으므로 캐시를 구독하지 않는다. (TBD: GET /fixed-expenses/{id} 를 백엔드에 요청)
 */
export function useCachedFixedExpense(fixedExpenseId: number | null): CalendarEntry | null {
  const cache = useQueryClient().getQueryCache();
  if (fixedExpenseId === null) return null;

  for (const query of cache.findAll({ queryKey: paymentKeys.calendar() })) {
    const calendar = query.state.data as PaymentCalendar | undefined;
    const found = calendar?.entries.find((entry) => entry.fixedExpenseId === fixedExpenseId);
    if (found !== undefined) return found;
  }
  return null;
}
