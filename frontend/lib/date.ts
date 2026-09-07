export class InvalidDateError extends Error {
  constructor() {
    super("시각은 시간대가 포함된 ISO-8601 문자열이어야 합니다");
    this.name = "InvalidDateError";
  }
}

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type KSTParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

export function parseISODate(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new InvalidDateError();
    return value;
  }
  const parsed = parseISODate(value);
  if (!parsed) throw new InvalidDateError();
  return parsed;
}

export function getKSTParts(value: string | Date): KSTParts {
  const shifted = new Date(toDate(value).getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatDate(value: string | Date): string {
  const { year, month, day } = getKSTParts(value);
  return `${year}.${pad2(month)}.${pad2(day)}`;
}

export function formatTime(value: string | Date): string {
  const { hour, minute } = getKSTParts(value);
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

export function formatMonthDay(value: string | Date): string {
  const { month, day, weekday } = getKSTParts(value);
  return `${month}월 ${day}일 (${WEEKDAY_LABELS[weekday]})`;
}

export function toKSTDateKey(value: string | Date): string {
  const { year, month, day } = getKSTParts(value);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export type ServerClock = {
  sync: (dateHeader: string) => void;
  now: () => Date;
  offsetMs: () => number;
};

export function createServerClock(deviceNow: () => number = Date.now): ServerClock {
  let offset = 0;
  return {
    sync(dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      if (Number.isNaN(serverTime)) return;
      offset = serverTime - deviceNow();
    },
    now: () => new Date(deviceNow() + offset),
    offsetMs: () => offset,
  };
}

export const serverClock = createServerClock();
