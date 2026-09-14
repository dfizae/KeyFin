import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveTransfer,
  createFixedExpense,
  deleteFixedExpense,
  getPaymentCalendar,
  getTransfers,
  postponeTransfer,
  updateFixedExpense,
  type TransferListParams,
} from "@/features/payment/api/payment.api";
import type { CalendarEntry, PaymentCalendar } from "@/features/payment/model";
import { roomKeys } from "@/features/room/api/queries";

export const paymentKeys = {
  all: ["payment"] as const,
  /** 고정지출·이체 변경 시 달 구분 없이 무효화하는 키 (docs/api-guide.md §무효화) */
  calendar: () => [...paymentKeys.all, "calendar"] as const,
  calendarMonth: (month: string) => [...paymentKeys.calendar(), month] as const,
  /** 이체 제안·이력. 승인·연기 뒤 달 구분 없이 무효화한다 */
  transfers: () => [...paymentKeys.all, "transfers"] as const,
  transferList: (params: TransferListParams) => [...paymentKeys.transfers(), params] as const,
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

export function transferListQueryOptions(params: TransferListParams) {
  return queryOptions({
    queryKey: paymentKeys.transferList(params),
    queryFn: ({ signal }) => getTransfers(params, signal),
    staleTime: 30_000,
  });
}

/** 이체 승인 화면(PAGE-25)이 쓰는 제안 목록. 단건 조회가 없어 목록에서 id 를 찾는다 */
export function useTransfers(params: TransferListParams) {
  return useQuery(transferListQueryOptions(params));
}

/**
 * 승인은 돈이 실제로 움직인다 (규칙 80): 자동 재시도를 끄고, 성공하면 제안 목록과 결제 캘린더(준비 상태)를 다시 받는다.
 * 네트워크 오류로 결과를 모를 때도 목록을 다시 받아 서버 상태로 확정한다.
 */
export function useApproveTransfer() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: paymentKeys.transfers() });
    void queryClient.invalidateQueries({ queryKey: paymentKeys.calendar() });
    void queryClient.invalidateQueries({ queryKey: roomKeys.all });
  };
  return useMutation({ mutationFn: approveTransfer, retry: false, onSuccess: invalidate, onError: invalidate });
}

/** 연기는 제안을 PROPOSED 로 남긴다. 목록만 다시 받는다 */
export function usePostponeTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postponeTransfer,
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentKeys.transfers() }),
  });
}
