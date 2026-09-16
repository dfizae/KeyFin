import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { accountKeys } from "@/features/account/api/queries";
import { isStaleAccountError } from "@/features/account/errors";
import {
  approveTransfer,
  createFixedExpense,
  deleteFixedExpense,
  getFixedExpenses,
  getPaymentCalendar,
  getTransfers,
  postponeTransfer,
  updateFixedExpense,
  type TransferListParams,
} from "@/features/payment/api/payment.api";
import { isStaleFixedExpenseError } from "@/features/payment/errors";
import { findFixedExpense } from "@/features/payment/model";
import { roomKeys } from "@/features/room/api/queries";

export const paymentKeys = {
  all: ["payment"] as const,
  /** 고정지출·이체 변경 시 달 구분 없이 무효화하는 키 (docs/api-guide.md §무효화) */
  calendar: () => [...paymentKeys.all, "calendar"] as const,
  calendarMonth: (month: string) => [...paymentKeys.calendar(), month] as const,
  /** 활성 고정지출 목록(GET /fixed-expenses). 관리 화면과 수정 화면이 같이 쓴다 */
  fixedExpenses: () => [...paymentKeys.all, "fixed-expenses"] as const,
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

export function fixedExpensesQueryOptions() {
  return queryOptions({
    queryKey: paymentKeys.fixedExpenses(),
    queryFn: ({ signal }) => getFixedExpenses(signal),
    staleTime: 30_000,
  });
}

/** 고정지출 관리 화면의 목록 */
export function useFixedExpenses() {
  return useQuery(fixedExpensesQueryOptions());
}

/**
 * 고정지출 수정 화면(PAGE-26)의 한 건. 단건 조회 API 가 없어 목록 조회에서 고른다(관리 화면과 캐시를 나눠 쓴다).
 * 목록에 없으면(이미 삭제됨·잘못된 주소) data 가 null 이다.
 */
export function useFixedExpense(fixedExpenseId: number | null) {
  return useQuery({
    ...fixedExpensesQueryOptions(),
    enabled: fixedExpenseId !== null,
    select: (expenses) => (fixedExpenseId === null ? null : findFixedExpense(expenses, fixedExpenseId)),
  });
}

/**
 * 고정지출을 바꾸면 목록과, 달 구분 없이 캘린더를 무효화한다(출금일을 옮기면 다른 달로 갈 수 있다).
 * 이체 제안이 고정지출을 참조하고 방 캘린더 에셋도 캘린더 조회를 쓰므로 둘 다 함께 무효화한다 (docs/api-guide.md §5).
 * 이미 삭제됐거나 동기화 항목이라 거절되면(PAY_001·002) 화면이 낡은 것이라 같은 범위를, 계좌 오류(ACCOUNT_001·002)면 계좌 목록을 다시 받는다.
 */
function useFixedExpenseMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  const refreshSchedules = () => {
    void queryClient.invalidateQueries({ queryKey: paymentKeys.fixedExpenses() });
    void queryClient.invalidateQueries({ queryKey: paymentKeys.calendar() });
    void queryClient.invalidateQueries({ queryKey: paymentKeys.transfers() });
    void queryClient.invalidateQueries({ queryKey: roomKeys.all });
  };
  return useMutation({
    mutationFn,
    onSuccess: refreshSchedules,
    onError: (error) => {
      if (isStaleFixedExpenseError(error)) refreshSchedules();
      if (isStaleAccountError(error)) void queryClient.invalidateQueries({ queryKey: accountKeys.all });
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
