import { USE_MOCKS, api } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { createFixedExpenseMock, deleteFixedExpenseMock, paymentCalendarMock, updateFixedExpenseMock } from "@/api/mocks/payment";
import {
  toPaymentCalendar,
  type FixedExpenseRequest,
  type FixedExpenseResponseDto,
  type PaymentCalendar,
  type PaymentCalendarDto,
} from "@/features/payment/model";

/** GET /payments/calendar?month=YYYYMM — 날짜별 출금 예정과 준비 상태 (docs/api-contract.md PAYMENT, FR-PAY-01·02) */
export async function getPaymentCalendar(month: string, signal?: AbortSignal): Promise<PaymentCalendar> {
  if (USE_MOCKS) return toPaymentCalendar(await withMockLatency(paymentCalendarMock(month), signal));
  const { data } = await api.get<PaymentCalendarDto>("/payments/calendar", { params: { month }, signal });
  return toPaymentCalendar(data);
}

/** POST /fixed-expenses — 201 (FR-PAY-07). 응답은 새 id 뿐이라 화면은 캘린더를 다시 받는다 */
export async function createFixedExpense(request: FixedExpenseRequest): Promise<number> {
  if (USE_MOCKS) return (await withMockLatency(createFixedExpenseMock(request))).id;
  const { data } = await api.post<FixedExpenseResponseDto>("/fixed-expenses", request);
  return data.id;
}

export type UpdateFixedExpenseInput = { id: number; request: FixedExpenseRequest };

/**
 * PUT /fixed-expenses/{id} — 계약 사본에 요청 형태가 없다("POST 와 같다고 가정하지 말 것").
 * 화면을 열어 두려고 지금은 POST 본문을 그대로 보내고, 스펙이 오면 이 함수만 고친다 (TBD, 규칙 90).
 */
export async function updateFixedExpense({ id, request }: UpdateFixedExpenseInput): Promise<number> {
  if (USE_MOCKS) return (await withMockLatency(updateFixedExpenseMock(id, request))).id;
  const { data } = await api.put<FixedExpenseResponseDto>(`/fixed-expenses/${id}`, request);
  return data.id;
}

/** DELETE /fixed-expenses/{id} — 응답 형태 미확인이라 본문을 읽지 않는다 (TBD) */
export async function deleteFixedExpense(id: number): Promise<void> {
  if (USE_MOCKS) {
    await withMockLatency(deleteFixedExpenseMock(id));
    return;
  }
  await api.delete(`/fixed-expenses/${id}`);
}
