import { USE_MOCKS, api } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { paymentCalendarMock } from "@/api/mocks/payment";
import { toPaymentCalendar, type PaymentCalendar, type PaymentCalendarDto } from "@/features/payment/model";

/** GET /payments/calendar?month=YYYYMM — 날짜별 출금 예정과 준비 상태 (docs/api-contract.md PAYMENT, FR-PAY-01·02) */
export async function getPaymentCalendar(month: string, signal?: AbortSignal): Promise<PaymentCalendar> {
  if (USE_MOCKS) return toPaymentCalendar(await withMockLatency(paymentCalendarMock(month), signal));
  const { data } = await api.get<PaymentCalendarDto>("/payments/calendar", { params: { month }, signal });
  return toPaymentCalendar(data);
}
