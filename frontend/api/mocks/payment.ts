import type { PaymentCalendarDto } from "@/features/payment/model";

/**
 * GET /payments/calendar?month= 응답 예시 (docs/api-contract.md PAYMENT).
 * 값은 Pencil home/p0/calendar-open CalendarPopover (ZzspU) 와 같다: 15일 월세 550,000(부족 230,000) · 20일 넷플릭스 17,000 · 25일 통신비 55,000(예상).
 */
export function paymentCalendarMock(month: string): PaymentCalendarDto {
  const date = (day: number) => `${month.slice(0, 4)}-${month.slice(4)}-${String(day).padStart(2, "0")}`;

  return {
    days: [
      {
        date: date(15),
        items: [{ type: "FIXED", fixedExpenseId: 11, name: "월세", amount: 550000, withdrawalAccountId: 1, prepared: false, shortage: 230000 }],
      },
      {
        date: date(20),
        items: [{ type: "FIXED", fixedExpenseId: 12, name: "넷플릭스", amount: 17000, withdrawalAccountId: 1, prepared: true, shortage: 0 }],
      },
      {
        date: date(25),
        items: [{ type: "CARD_BILL", cardId: 3, name: "통신비", amount: 55000, estimated: true, prepared: true, shortage: 0 }],
      },
    ],
  };
}

/** 이번 달 출금 예정이 없는 달 */
export const paymentCalendarEmptyMock: PaymentCalendarDto = { days: [] };
