import { ApiError } from "@/api/error";
import type {
  CalendarItemDto,
  CardBillingsDto,
  FixedExpenseDto,
  FixedExpenseListDto,
  FixedExpenseRequest,
  PaymentCalendarDto,
} from "@/features/payment/model";
import { currentDateKey } from "@/lib/date";

/**
 * GET /payments/calendar · GET/POST/PUT/DELETE /fixed-expenses 목 (docs/api-contract.md PAYMENT).
 * 값은 Pencil home/p0/calendar-open CalendarPopover (ZzspU) 와 같다: 15일 월세 550,000(부족 230,000) · 20일 넷플릭스 17,000 · 25일 통신비 55,000(예상).
 *
 * 서버처럼 상태를 들고 있다: 등록·수정·삭제가 목록과 캘린더에 그대로 반영되고, 서버와 같은 오류(PAY_001~004)를 던진다.
 * 넷플릭스는 금융망에서 동기화된 카드 정기결제(CARD_SUBSCRIPTION)라 수정·삭제가 막힌다.
 * prepared·shortage 는 실서버가 필요 금액 계산(FR-PAY-02) 전까지 null 을 주지만, 목은 시안 값을 유지한다(사용자 결정 2026-09-15).
 */
type MockFixedExpense = {
  id: number;
  name: string;
  expenseType: FixedExpenseRequest["expenseType"];
  amount: number;
  isVariable: boolean;
  paymentDay: number;
  withdrawalAccountId: number | null;
  /** 금융망 정기결제 id. 있으면 동기화 항목이다 */
  finSubscriptionId: string | null;
  prepared: boolean;
  shortage: number;
};

const INITIAL_FIXED: MockFixedExpense[] = [
  {
    id: 11,
    name: "월세",
    expenseType: "RENT",
    amount: 550000,
    isVariable: false,
    paymentDay: 15,
    withdrawalAccountId: 1,
    finSubscriptionId: null,
    prepared: false,
    shortage: 230000,
  },
  {
    id: 12,
    name: "넷플릭스",
    expenseType: "SUBSCRIPTION",
    amount: 17000,
    isVariable: false,
    paymentDay: 20,
    withdrawalAccountId: null,
    finSubscriptionId: "SUB-0001",
    prepared: true,
    shortage: 0,
  },
  {
    id: 13,
    name: "통신비",
    expenseType: "UTILITY",
    amount: 55000,
    isVariable: true,
    paymentDay: 25,
    withdrawalAccountId: 1,
    finSubscriptionId: null,
    prepared: true,
    shortage: 0,
  },
];

let fixedExpenses: MockFixedExpense[] = INITIAL_FIXED.map((expense) => ({ ...expense }));
let nextId = 100;

/** 같은 날 순서: FIXED → CARD_SUBSCRIPTION → CARD_BILL, 금액 내림차순 (서버 PaymentCalendarService) */
const TYPE_ORDER: Record<string, number> = { FIXED: 0, CARD_SUBSCRIPTION: 1, CARD_BILL: 2 };

function lastDayOf(month: string): number {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(4)), 0)).getUTCDate();
}

function dayKey(month: string, day: number): string {
  return `${month.slice(0, 4)}-${month.slice(4)}-${String(day).padStart(2, "0")}`;
}

function isSynced(expense: MockFixedExpense): boolean {
  return expense.finSubscriptionId !== null;
}

function toCalendarItem(expense: MockFixedExpense): CalendarItemDto {
  return {
    type: isSynced(expense) ? "CARD_SUBSCRIPTION" : "FIXED",
    fixedExpenseId: expense.id,
    cardId: null,
    name: expense.name,
    expenseType: expense.expenseType,
    amount: expense.amount,
    estimated: expense.isVariable,
    withdrawalAccountId: expense.withdrawalAccountId,
    prepared: expense.prepared,
    shortage: expense.shortage,
  };
}

export function paymentCalendarMock(month: string): PaymentCalendarDto {
  const lastDay = lastDayOf(month);
  const days = new Map<string, CalendarItemDto[]>();
  for (const expense of [...fixedExpenses].sort((a, b) => a.id - b.id)) {
    // 출금일이 없는 달(29~31)은 말일로 보정한다
    const date = dayKey(month, Math.min(expense.paymentDay, lastDay));
    const bucket = days.get(date);
    if (bucket) bucket.push(toCalendarItem(expense));
    else days.set(date, [toCalendarItem(expense)]);
  }

  return {
    month,
    days: [...days]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.amount - a.amount),
      })),
  };
}

/** GET /fixed-expenses — 활성 항목을 등록 순(id 오름차순)으로 */
export function fixedExpenseListMock(): FixedExpenseListDto {
  return [...fixedExpenses]
    .sort((a, b) => a.id - b.id)
    .map(
      (expense): FixedExpenseDto => ({
        id: expense.id,
        name: expense.name,
        expenseType: expense.expenseType,
        amount: expense.amount,
        isVariable: expense.isVariable,
        paymentDay: expense.paymentDay,
        withdrawalAccountId: expense.withdrawalAccountId,
        synced: isSynced(expense),
      })
    );
}

function assertManualType(request: FixedExpenseRequest): void {
  if ((request.expenseType as string) === "CARD_BILL") {
    throw new ApiError(400, "PAY_004", "카드 청구는 직접 등록할 수 없습니다.");
  }
}

/** 수정·삭제 대상. 없거나 이미 지운 항목은 404, 동기화 항목은 409 */
function findManual(id: number): MockFixedExpense {
  const expense = fixedExpenses.find((candidate) => candidate.id === id);
  if (expense === undefined) throw new ApiError(404, "PAY_001", "고정지출을 찾을 수 없습니다.");
  if (isSynced(expense)) {
    throw new ApiError(409, "PAY_002", "금융망에서 동기화된 항목은 KeyFin에서 변경할 수 없습니다.");
  }
  return expense;
}

/** POST /fixed-expenses — 새 고정지출은 잔액을 모르니 준비된 것으로 둔다 */
export function createFixedExpenseMock(request: FixedExpenseRequest): { id: number } {
  assertManualType(request);
  const duplicated = fixedExpenses.some(
    (expense) =>
      expense.name === request.name &&
      expense.expenseType === request.expenseType &&
      expense.amount === request.amount &&
      expense.paymentDay === request.paymentDay &&
      expense.withdrawalAccountId === request.withdrawalAccountId
  );
  if (duplicated) throw new ApiError(409, "PAY_003", "같은 내용의 고정지출이 이미 등록되어 있습니다.");

  nextId += 1;
  fixedExpenses = [...fixedExpenses, { ...request, id: nextId, finSubscriptionId: null, prepared: true, shortage: 0 }];
  return { id: nextId };
}

/** PUT /fixed-expenses/{id} — 본문 전체로 교체한다. 준비 상태는 서버가 다시 계산하므로 목에서는 그대로 둔다 */
export function updateFixedExpenseMock(id: number, request: FixedExpenseRequest): { id: number } {
  const target = findManual(id);
  assertManualType(request);
  fixedExpenses = fixedExpenses.map((expense) => (expense === target ? { ...expense, ...request, id } : expense));
  return { id };
}

/** DELETE /fixed-expenses/{id} — 서버는 비활성으로 바꾸고, 목록·캘린더에서는 바로 사라진다 */
export function deleteFixedExpenseMock(id: number): void {
  const target = findManual(id);
  fixedExpenses = fixedExpenses.filter((expense) => expense !== target);
}

/**
 * GET /cards/billings 목. 카드는 금융망 후보 목(api/mocks/link.ts)의 연결 카드 2장과 같은 id 를 쓴다 —
 * 자산 탭이 두 응답을 cardId 로 잇기 때문이다.
 * 1번(신한 Deep Dream 체크)은 이번 주기 승인 2건과 발행된 청구서가 있고,
 * 2번(국민 노리 체크)은 출금 요일을 모르는 카드(재연결 필요)라 출금일이 없고 청구서도 없다 — 서버가 null 을 주는 경우를 폰에서 보기 위한 값이다.
 */
export function cardBillingsMock(todayKey: string = currentDateKey()): CardBillingsDto {
  const day = Number(todayKey.slice(8, 10));
  const prefix = todayKey.slice(0, 8);
  const dayKey = (value: number) => `${prefix}${String(Math.min(Math.max(value, 1), 28)).padStart(2, "0")}`;

  return {
    asOf: todayKey,
    cycleFrom: dayKey(day - 2),
    nextBillingDate: dayKey(day + 5),
    cards: [
      {
        cardId: 1,
        cardName: "Deep Dream 체크",
        withdrawalWeekday: 3,
        withdrawalAccountId: 1,
        estimated: { amount: 38200, approvalCount: 4, withdrawalDate: dayKey(day + 7) },
        latestStatement: {
          billingId: 12,
          billingDate: dayKey(day - 2),
          amount: 214000,
          status: "UNPAID",
          withdrawalDate: dayKey(day + 2),
          paidAt: null,
        },
      },
      {
        cardId: 2,
        cardName: "노리 체크",
        withdrawalWeekday: null,
        withdrawalAccountId: 1,
        estimated: { amount: 0, approvalCount: 0, withdrawalDate: null },
        latestStatement: null,
      },
    ],
  };
}

/** 테스트·개발 재시작용 */
export function resetPaymentMocks(): void {
  fixedExpenses = INITIAL_FIXED.map((expense) => ({ ...expense }));
  nextId = 100;
}

/** 출금 예정이 없는 달 */
export const paymentCalendarEmptyMock: PaymentCalendarDto = { month: "202609", days: [] };
