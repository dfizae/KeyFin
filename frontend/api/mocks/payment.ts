import type { CalendarItemDto, FixedExpenseRequest, PaymentCalendarDto } from "@/features/payment/model";

/**
 * GET /payments/calendar?month= 응답 예시 (docs/api-contract.md PAYMENT).
 * 값은 Pencil home/p0/calendar-open CalendarPopover (ZzspU) 와 같다: 15일 월세 550,000(부족 230,000) · 20일 넷플릭스 17,000 · 25일 통신비 55,000(예상).
 *
 * 서버처럼 상태를 들고 있다: 등록·수정·삭제(POST/PUT/DELETE /fixed-expenses)가 캘린더에 그대로 반영돼야
 * 화면 흐름을 목으로 확인할 수 있다. 카드 청구(CARD_BILL)는 사용자가 만드는 값이 아니라 고정이다.
 */
type MockFixedExpense = {
  id: number;
  name: string;
  amount: number;
  paymentDay: number;
  withdrawalAccountId: number;
  prepared: boolean;
  shortage: number;
};

const INITIAL_FIXED: MockFixedExpense[] = [
  { id: 11, name: "월세", amount: 550000, paymentDay: 15, withdrawalAccountId: 1, prepared: false, shortage: 230000 },
  { id: 12, name: "넷플릭스", amount: 17000, paymentDay: 20, withdrawalAccountId: 1, prepared: true, shortage: 0 },
];

const CARD_BILL: { cardId: number; name: string; amount: number; paymentDay: number } = {
  cardId: 3,
  name: "통신비",
  amount: 55000,
  paymentDay: 25,
};

let fixedExpenses: MockFixedExpense[] = [...INITIAL_FIXED];
let nextId = 100;

function dayKey(month: string, day: number): string {
  return `${month.slice(0, 4)}-${month.slice(4)}-${String(day).padStart(2, "0")}`;
}

export function paymentCalendarMock(month: string): PaymentCalendarDto {
  const items: { day: number; item: CalendarItemDto }[] = [
    ...fixedExpenses.map((expense) => ({
      day: expense.paymentDay,
      item: {
        type: "FIXED",
        fixedExpenseId: expense.id,
        name: expense.name,
        amount: expense.amount,
        withdrawalAccountId: expense.withdrawalAccountId,
        prepared: expense.prepared,
        shortage: expense.shortage,
      } satisfies CalendarItemDto,
    })),
    {
      day: CARD_BILL.paymentDay,
      item: {
        type: "CARD_BILL",
        cardId: CARD_BILL.cardId,
        name: CARD_BILL.name,
        amount: CARD_BILL.amount,
        estimated: true,
        prepared: true,
        shortage: 0,
      } satisfies CalendarItemDto,
    },
  ];

  const days = new Map<string, CalendarItemDto[]>();
  for (const { day, item } of items.sort((a, b) => a.day - b.day)) {
    const date = dayKey(month, day);
    const bucket = days.get(date);
    if (bucket) bucket.push(item);
    else days.set(date, [item]);
  }

  return { days: [...days].map(([date, dayItems]) => ({ date, items: dayItems })) };
}

/** POST /fixed-expenses — 새 고정지출은 잔액을 모르니 준비된 것으로 둔다 */
export function createFixedExpenseMock(request: FixedExpenseRequest): { id: number } {
  nextId += 1;
  fixedExpenses = [
    ...fixedExpenses,
    {
      id: nextId,
      name: request.name,
      amount: request.amount,
      paymentDay: request.paymentDay,
      withdrawalAccountId: request.withdrawalAccountId,
      prepared: true,
      shortage: 0,
    },
  ];
  return { id: nextId };
}

/** PUT /fixed-expenses/{id} — 준비 상태는 서버 배치가 다시 계산하므로 목에서는 그대로 둔다 */
export function updateFixedExpenseMock(id: number, request: FixedExpenseRequest): { id: number } {
  fixedExpenses = fixedExpenses.map((expense) =>
    expense.id === id
      ? {
          ...expense,
          name: request.name,
          amount: request.amount,
          paymentDay: request.paymentDay,
          withdrawalAccountId: request.withdrawalAccountId,
        }
      : expense
  );
  return { id };
}

export function deleteFixedExpenseMock(id: number): void {
  fixedExpenses = fixedExpenses.filter((expense) => expense.id !== id);
}

/** 캘린더에서 수정 화면으로 넘어갈 때 목이 들고 있는 값 (실서버에는 단건 조회가 없다 — TBD) */
export function findFixedExpenseMock(id: number): MockFixedExpense | undefined {
  return fixedExpenses.find((expense) => expense.id === id);
}

/** 테스트·개발 재시작용 */
export function resetPaymentMocks(): void {
  fixedExpenses = [...INITIAL_FIXED];
  nextId = 100;
}

/** 이번 달 출금 예정이 없는 달 */
export const paymentCalendarEmptyMock: PaymentCalendarDto = { days: [] };
