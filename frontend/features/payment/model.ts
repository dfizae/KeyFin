import { ContractMismatchError } from "@/lib/contract";
import { fromServerWon, type KRW } from "@/lib/money";

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
