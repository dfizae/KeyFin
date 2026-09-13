import { ContractMismatchError } from "@/lib/contract";
import { fromServerWon, toWon, type KRW } from "@/lib/money";

/**
 * GET /payments/calendar?month=YYYYMM 계약 (docs/api-contract.md PAYMENT, FR-PAY-01·02).
 * prepared·shortage 는 매일 06:00 배치가 계산하는 서버 파생값이라 검증만 하고 다시 계산하지 않는다.
 * estimated=true 는 발행 전 카드 청구 예정액이다.
 */
export const PAYMENT_TYPES = ["FIXED", "CARD_BILL"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number] | "UNKNOWN";

export type CalendarItemDto = {
  type: string;
  fixedExpenseId?: number;
  cardId?: number;
  name: string;
  amount: number;
  withdrawalAccountId?: number;
  estimated?: boolean;
  prepared: boolean;
  shortage: number;
};

export type CalendarDayDto = {
  /** "2026-09-15" */
  date: string;
  items: CalendarItemDto[];
};

export type PaymentCalendarDto = { days: CalendarDayDto[] };

export type CalendarEntry = {
  /** 같은 날 여러 건이 올 수 있어 date 만으로는 목록 키가 안 된다 */
  key: string;
  date: string;
  /** 고정지출만 있다. 수정 화면(PAGE-26)으로 갈 수 있는 건인지 가른다 */
  fixedExpenseId: number | null;
  withdrawalAccountId: number | null;
  /** 날짜의 일(1~31) */
  day: number;
  type: PaymentType;
  name: string;
  amount: KRW;
  estimated: boolean;
  prepared: boolean;
  /** 0 이면 준비된 건 */
  shortage: KRW;
};

export type PaymentCalendar = {
  entries: CalendarEntry[];
  /** prepared=false 인 건수 */
  shortageCount: number;
};

const DATE = /^\d{4}-(\d{2})-(\d{2})$/;

function won(value: number, field: string): KRW {
  try {
    return fromServerWon(value);
  } catch {
    throw new ContractMismatchError(field);
  }
}

function toType(raw: string): PaymentType {
  return (PAYMENT_TYPES as readonly string[]).includes(raw) ? (raw as PaymentType) : "UNKNOWN";
}

export function toPaymentCalendar(dto: PaymentCalendarDto): PaymentCalendar {
  const days = [...dto.days].sort((a, b) => a.date.localeCompare(b.date));
  const entries = days.flatMap((day) => {
    const matched = DATE.exec(day.date);
    if (!matched) throw new ContractMismatchError("days.date");
    return day.items.map((item, index) => ({
      key: `${day.date}#${index}`,
      date: day.date,
      fixedExpenseId: item.fixedExpenseId ?? null,
      withdrawalAccountId: item.withdrawalAccountId ?? null,
      day: Number(matched[2]),
      type: toType(item.type),
      name: item.name,
      amount: won(item.amount, "items.amount"),
      estimated: item.estimated ?? false,
      prepared: item.prepared,
      shortage: won(item.shortage, "items.shortage"),
    }));
  });

  return { entries, shortageCount: entries.filter((entry) => !entry.prepared).length };
}

/** 자산 탭 "이번 달 정기결제 예정": 오늘 포함 이후 건을 날짜순으로 limit 건까지 */
export function upcomingEntries(calendar: PaymentCalendar, todayKey: string, limit: number): CalendarEntry[] {
  return calendar.entries.filter((entry) => entry.date >= todayKey).slice(0, limit);
}

/** 방 캘린더 에셋에 한 건만 띄우기 위한 선택. 오늘 이후 첫 건, 이번 달이 다 지났으면 마지막 건. */
export function upcomingEntry(calendar: PaymentCalendar, todayKey: string): CalendarEntry | null {
  if (calendar.entries.length === 0) return null;
  return calendar.entries.find((entry) => entry.date >= todayKey) ?? calendar.entries[calendar.entries.length - 1];
}

/** 고정지출 유형 (docs/api-contract.md 열거형 ExpenseType) */
export const EXPENSE_TYPES = ["RENT", "SUBSCRIPTION", "CARD_BILL", "LOAN", "UTILITY"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const MIN_PAYMENT_DAY = 1;
export const MAX_PAYMENT_DAY = 31;

/** 고정지출 등록·수정 화면(PAGE-26)의 입력값. 금액·출금일은 입력 중 상태를 그대로 두려고 문자열이다 */
export type FixedExpenseForm = {
  name: string;
  expenseType: ExpenseType;
  /** 원 단위 숫자만 있는 문자열(AmountInput) */
  amount: string;
  /** "1"~"31" */
  paymentDay: string;
  withdrawalAccountId: number | null;
};

/** POST /fixed-expenses 요청 (docs/api-contract.md PAYMENT, FR-PAY-07) */
export type FixedExpenseRequest = {
  name: string;
  expenseType: ExpenseType;
  amount: number;
  paymentDay: number;
  withdrawalAccountId: number;
  isVariable?: boolean;
};

export type FixedExpenseResponseDto = { id: number };

const PAYMENT_DAY = /^\d{1,2}$/;

/**
 * 저장할 수 없는 이유. 없으면 null.
 * 서버가 다시 검사하므로(출금일 29~31 말일 보정도 서버) 여기서는 보낼 수 있는 형태인지만 본다.
 */
export function fixedExpenseFormError(form: FixedExpenseForm): string | null {
  if (form.name.trim() === "") return "이름을 입력해 주세요.";
  if (form.amount === "" || toWon(form.amount) <= 0n) return "금액을 입력해 주세요.";
  const day = Number(form.paymentDay);
  if (!PAYMENT_DAY.test(form.paymentDay) || day < MIN_PAYMENT_DAY || day > MAX_PAYMENT_DAY) {
    return `출금일은 ${MIN_PAYMENT_DAY}~${MAX_PAYMENT_DAY} 사이로 입력해 주세요.`;
  }
  if (form.withdrawalAccountId === null) return "출금 계좌를 골라 주세요.";
  return null;
}

/** 화면 값 → 요청 본문. 공과금은 달마다 금액이 달라 isVariable 을 붙인다 (계약 사본 PAYMENT) */
export function toFixedExpenseRequest(form: FixedExpenseForm): FixedExpenseRequest {
  const error = fixedExpenseFormError(form);
  if (error !== null || form.withdrawalAccountId === null) throw new Error(error ?? "고정지출 입력이 올바르지 않습니다");
  const request: FixedExpenseRequest = {
    name: form.name.trim(),
    expenseType: form.expenseType,
    amount: Number(toWon(form.amount)),
    paymentDay: Number(form.paymentDay),
    withdrawalAccountId: form.withdrawalAccountId,
  };
  return form.expenseType === "UTILITY" ? { ...request, isVariable: true } : request;
}

export type CalendarDayGroup = {
  date: string;
  day: number;
  entries: CalendarEntry[];
};

/** 결제 캘린더(PAGE-24)는 날짜로 묶어 보여준다. entries 는 이미 날짜순이다 */
export function groupEntriesByDate(entries: CalendarEntry[]): CalendarDayGroup[] {
  const groups: CalendarDayGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, day: entry.day, entries: [entry] });
  }
  return groups;
}

export const NEW_FIXED_EXPENSE_ID = "new";

/** 고정지출 화면의 라우트 파라미터. "new" 는 등록, 양의 정수는 수정, 나머지는 잘못된 주소다 */
export type FixedExpenseRoute = { mode: "create" } | { mode: "edit"; id: number } | null;

export function parseFixedExpenseRoute(value: string | string[] | undefined): FixedExpenseRoute {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === NEW_FIXED_EXPENSE_ID) return { mode: "create" };
  return raw !== undefined && /^[1-9]\d*$/.test(raw) ? { mode: "edit", id: Number(raw) } : null;
}

const MONTH_KEY = /^\d{4}(0[1-9]|1[0-2])$/;

/** 결제 캘린더의 month 검색 파라미터. 형식이 틀리면 이번 달. 앞으로 나갈 출금이라 미래 달도 본다 */
export function parseCalendarMonth(value: string | string[] | undefined, currentMonth: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw !== undefined && MONTH_KEY.test(raw) ? raw : currentMonth;
}
