import { ContractMismatchError } from "@/lib/contract";
import { formatKRW } from "@/lib/money";

/**
 * GET /fin-coins?cursor=&size= · GET /fin-coins/balance 계약 (백엔드 develop FinCoinController, 2026-09-17 대조, FR-GAM-08).
 * 이력은 id 내림차순(최신순) 커서 페이지다. delta 는 적립 양수·사용 음수, balanceAfter 는 그 이력 반영 후 잔액(서버 값, 다시 계산하지 않는다).
 * reasonText 는 서버가 사유 코드로 만든 문구라 그대로 보여 준다. grantDate 는 지급 기준일(시각 없음)이다.
 * 잔액은 이력 응답에 없어 GET /fin-coins/balance 로 따로 받는다(이력이 없으면 0).
 */
export const COIN_REASONS = ["ATTEND", "CONFIRM_ALL", "WEEKLY", "MONTHLY", "PURCHASE"] as const;
export type CoinReason = (typeof COIN_REASONS)[number] | "UNKNOWN";

export type CoinHistoryItemDto = {
  id: number;
  delta: number;
  balanceAfter: number;
  reasonCode: string;
  reasonText: string;
  /** "2026-09-10" */
  grantDate: string;
};

export type CoinHistoryDto = { items: CoinHistoryItemDto[]; nextCursor: number | null };

export type CoinBalanceDto = { balance: number };

export type CoinHistoryItem = {
  id: number;
  delta: number;
  balanceAfter: number;
  reason: CoinReason;
  reasonText: string;
  grantDate: string;
};

export type CoinHistoryPage = { items: CoinHistoryItem[]; nextCursor: number | null };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function toCoinReason(raw: string): CoinReason {
  return (COIN_REASONS as readonly string[]).includes(raw) ? (raw as CoinReason) : "UNKNOWN";
}

function isCoinCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function toCoinHistoryItem(dto: CoinHistoryItemDto): CoinHistoryItem {
  if (!Number.isSafeInteger(dto.id) || dto.id <= 0) throw new ContractMismatchError("items.id");
  if (!Number.isSafeInteger(dto.delta)) throw new ContractMismatchError("items.delta");
  if (!isCoinCount(dto.balanceAfter)) throw new ContractMismatchError("items.balanceAfter");
  if (!DATE_KEY.test(dto.grantDate)) throw new ContractMismatchError("items.grantDate");
  return {
    id: dto.id,
    delta: dto.delta,
    balanceAfter: dto.balanceAfter,
    reason: toCoinReason(dto.reasonCode),
    reasonText: dto.reasonText,
    grantDate: dto.grantDate,
  };
}

export function toCoinHistoryPage(dto: CoinHistoryDto): CoinHistoryPage {
  return { items: dto.items.map(toCoinHistoryItem), nextCursor: dto.nextCursor };
}

export function toCoinBalance(dto: CoinBalanceDto): number {
  if (!isCoinCount(dto.balance)) throw new ContractMismatchError("balance");
  return dto.balance;
}

/** 코인 수 "1,260". 홈 코인 배지와 같은 자릿수 구분이다 */
export function coinCountLabel(count: number): string {
  return formatKRW(String(count), { unit: false });
}

/** 증감 "+10" · "-300" */
export function coinDeltaLabel(delta: number): string {
  return formatKRW(String(delta), { unit: false, sign: "always" });
}

/** 읽어 주는 문구: "10코인 적립" · "300코인 사용" */
export function coinDeltaSpoken(delta: number): string {
  const count = coinCountLabel(Math.abs(delta));
  return delta < 0 ? `${count}코인 사용` : `${count}코인 적립`;
}

export type CoinDateGroup = { dateKey: string; items: CoinHistoryItem[] };

/** 지급 기준일로 묶는다. 서버가 최신순으로 주므로 순서를 바꾸지 않고 이어진 같은 날짜만 모은다 */
export function groupCoinHistoryByDate(items: CoinHistoryItem[]): CoinDateGroup[] {
  const groups: CoinDateGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.dateKey === item.grantDate) last.items.push(item);
    else groups.push({ dateKey: item.grantDate, items: [item] });
  }
  return groups;
}
