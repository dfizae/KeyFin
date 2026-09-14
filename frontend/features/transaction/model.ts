import { ContractMismatchError } from "@/lib/contract";
import { formatDate, formatDateTime, KST_LOCAL_DATE_TIME, parseKSTDateKey, parseKSTLocalDateTime } from "@/lib/date";
import { fromServerWon, type KRW } from "@/lib/money";

/**
 * TRANSACTION 계약 (docs/api-contract.md TRANSACTION). 열거형은 ERD 값이며 모르는 값은 UNKNOWN 으로 흡수한다.
 */
export const TX_TYPES = ["CARD", "DEPOSIT", "WITHDRAW", "TRANSFER"] as const;
export const CONFIRM_STATUSES = ["AUTO", "PENDING", "CONFIRMED"] as const;
export const EXCLUDE_TAGS = ["NONE", "DUTCH", "SELF_TRANSFER", "EMERGENCY", "CARRYOVER"] as const;
export const TX_STATUSES = ["NORMAL", "CANCELED"] as const;

export type TxType = (typeof TX_TYPES)[number] | "UNKNOWN";
export type ConfirmStatus = (typeof CONFIRM_STATUSES)[number] | "UNKNOWN";
export type ExcludeTag = (typeof EXCLUDE_TAGS)[number] | "UNKNOWN";
export type TxStatus = (typeof TX_STATUSES)[number] | "UNKNOWN";
/** 사용자가 고를 수 있는 제외 태그 (FR-TXN-05) */
export type UserExcludeTag = "DUTCH" | "SELF_TRANSFER" | "EMERGENCY";

export type TransactionDto = {
  id: number;
  txType: string;
  merchantName: string;
  amount: number;
  /** "YYYY-MM-DD" */
  txDate: string;
  /** "HH:mm:ss" */
  txTime: string;
  envelopeId: number;
  subcategoryId: number;
  subcategoryName: string;
  confirmStatus: string;
  excludeTag: string;
  status: string;
  memo?: string | null;
};

export type PendingTransactionsDto = { items: TransactionDto[]; nextCursor: number | null };
export type SubcategoryListDto = { items: SubcategoryDto[] };
export type SubcategoryDto = { id: number; name: string; envelopeId: number; envelopeName: string };

/** subcategoryId 와 excludeTag 중 하나만 보낸다 */
export type ClassifyRequest = { subcategoryId: number } | { excludeTag: UserExcludeTag };
export type ClassifyResponseDto = { confirmStatus: string; envelopeBalance: { envelopeId: number; remaining: number } };

export type Transaction = {
  id: number;
  txType: TxType;
  merchantName: string;
  amount: KRW;
  txDate: string;
  txTime: string;
  /** txDate 에서 뽑은 "YYYYMM" — 예산 캐시 키 */
  monthKey: string;
  envelopeId: number;
  subcategoryId: number;
  subcategoryName: string;
  confirmStatus: ConfirmStatus;
  excludeTag: ExcludeTag;
  status: TxStatus;
  memo: string | null;
};

export type PendingTransactions = { items: Transaction[]; nextCursor: number | null };
export type Subcategory = { id: number; name: string; envelopeId: number; envelopeName: string };
export type ClassifyResult = { confirmStatus: ConfirmStatus; envelopeId: number; remaining: KRW };

const TX_DATE = /^(\d{4})-(\d{2})-\d{2}$/;

function pick<T extends string>(values: readonly T[], raw: string): T | "UNKNOWN" {
  return (values as readonly string[]).includes(raw) ? (raw as T) : "UNKNOWN";
}

function won(value: number, field: string): KRW {
  try {
    return fromServerWon(value);
  } catch {
    throw new ContractMismatchError(field);
  }
}

export function toTransaction(dto: TransactionDto): Transaction {
  const date = TX_DATE.exec(dto.txDate);
  if (!date) throw new ContractMismatchError("txDate");
  return {
    id: dto.id,
    txType: pick(TX_TYPES, dto.txType),
    merchantName: dto.merchantName,
    amount: won(dto.amount, "amount"),
    txDate: dto.txDate,
    txTime: dto.txTime,
    monthKey: `${date[1]}${date[2]}`,
    envelopeId: dto.envelopeId,
    subcategoryId: dto.subcategoryId,
    subcategoryName: dto.subcategoryName,
    confirmStatus: pick(CONFIRM_STATUSES, dto.confirmStatus),
    excludeTag: pick(EXCLUDE_TAGS, dto.excludeTag),
    status: pick(TX_STATUSES, dto.status),
    memo: dto.memo ?? null,
  };
}

export function toPendingTransactions(dto: PendingTransactionsDto): PendingTransactions {
  return { items: dto.items.map(toTransaction), nextCursor: dto.nextCursor };
}

/**
 * GET /transactions 필터 (FR-TXN-09). month 는 필수고 계좌·카드는 둘 중 하나만 건다.
 * 값이 없는 필터는 키를 빼서 둔다 — 쿼리 키가 같은 필터에서 늘 같아야 캐시가 겹친다.
 */
export type TransactionFilter = {
  /** "YYYYMM" */
  month: string;
  envelopeId?: number;
  accountId?: number;
  cardId?: number;
};

export type TransactionListDto = { items: TransactionDto[]; nextCursor: number | null };
export type TransactionPage = { items: Transaction[]; nextCursor: number | null };

export function toTransactionPage(dto: TransactionListDto): TransactionPage {
  return { items: dto.items.map(toTransaction), nextCursor: dto.nextCursor };
}

/** 들어온 돈은 입금뿐이다. 이체(TRANSFER)는 방향이 계약에 없어 나간 돈으로 둔다 (TBD) */
export function isIncoming(transaction: Transaction): boolean {
  return transaction.txType === "DEPOSIT";
}

/** 목록의 "날짜 · 분류" 자리. 입금은 세분류 대신 "입금" 이라고 쓴다 */
export function transactionCategoryLabel(transaction: Transaction): string {
  return isIncoming(transaction) ? "입금" : transaction.subcategoryName;
}

const EXCLUDE_TAG_LABELS: Partial<Record<ExcludeTag, string>> = {
  DUTCH: "더치페이",
  SELF_TRANSFER: "내 계좌 이동",
  EMERGENCY: "비상금",
  CARRYOVER: "이월",
};

/** 취소·예산 제외 거래도 숨기지 않고 뱃지로 알린다(FR-TXN-09). 취소가 먼저다 */
export function transactionBadge(transaction: Transaction): string | null {
  if (transaction.status === "CANCELED") return "취소";
  return EXCLUDE_TAG_LABELS[transaction.excludeTag] ?? null;
}

/** 거래 상세(PAGE-21)의 거래 종류 자리. 계약에 없는 값은 "기타" 로 적는다 */
const TX_TYPE_LABELS: Record<TxType, string> = {
  CARD: "카드 결제",
  DEPOSIT: "입금",
  WITHDRAW: "계좌 출금",
  TRANSFER: "이체",
  UNKNOWN: "기타",
};

export function txTypeLabel(transaction: Transaction): string {
  return TX_TYPE_LABELS[transaction.txType];
}

/** 분류 상태 자리. 모르는 값은 자리를 비운다 */
const CONFIRM_STATUS_LABELS: Partial<Record<ConfirmStatus, string>> = {
  AUTO: "자동 분류",
  PENDING: "확인 필요",
  CONFIRMED: "확인 완료",
};

export function confirmStatusLabel(transaction: Transaction): string | null {
  return CONFIRM_STATUS_LABELS[transaction.confirmStatus] ?? null;
}

/** 거래 상세의 "2026.09.08 14:21". 서버는 날짜·시각을 따로 주므로 합쳐 읽고, 시각 형식이 틀리면 날짜만 쓴다 */
export function transactionDateTimeLabel(transaction: Transaction): string {
  const dateTime = `${transaction.txDate}T${transaction.txTime}`;
  return KST_LOCAL_DATE_TIME.test(dateTime)
    ? formatDateTime(parseKSTLocalDateTime(dateTime))
    : formatDate(parseKSTDateKey(transaction.txDate));
}

/**
 * 분류를 바꿀 수 없는 거래의 이유. 바꿀 수 있으면 null (FR-TXN-03·05).
 * 들어온 돈은 봉투에서 나가지 않고 취소된 결제는 봉투 합계에서 이미 빠졌다 — 서버 제약이 아니라 화면 판단이다 (TBD)
 */
export function reclassifyBlockedReason(transaction: Transaction): string | null {
  if (transaction.status === "CANCELED") return "취소된 결제는 분류를 바꿀 수 없어요.";
  if (isIncoming(transaction)) return "입금은 봉투에 들어가지 않아 분류가 없어요.";
  return null;
}

const MONTH_KEY = /^(\d{4})(0[1-9]|1[0-2])$/;
const POSITIVE_ID = /^[1-9]\d*$/;
const MONTHS_PER_YEAR = 12;

/** "202609" 을 delta 달만큼 옮긴다. 형식이 틀린 키는 그대로 돌려준다 */
export function shiftMonthKey(key: string, delta: number): string {
  const matched = MONTH_KEY.exec(key);
  if (!matched) return key;
  const index = Number(matched[1]) * MONTHS_PER_YEAR + Number(matched[2]) - 1 + delta;
  return `${Math.floor(index / MONTHS_PER_YEAR)}${String((index % MONTHS_PER_YEAR) + 1).padStart(2, "0")}`;
}

/** "202609" → "2026년 9월" */
export function monthFilterLabel(key: string): string {
  const matched = MONTH_KEY.exec(key);
  return matched ? `${matched[1]}년 ${Number(matched[2])}월` : key;
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function idParam(value: string | string[] | undefined): number | undefined {
  const raw = firstParam(value);
  return raw !== undefined && POSITIVE_ID.test(raw) ? Number(raw) : undefined;
}

/**
 * 거래 내역 화면의 검색 파라미터를 필터로 바꾼다. 라우트 파라미터는 믿지 않고 형식이 틀리면 버린다.
 * 달이 없거나 틀리거나 미래면 이번 달로, 계좌와 카드가 둘 다 오면 계좌만 쓴다.
 */
export function parseTransactionFilter(params: SearchParams, currentMonth: string): TransactionFilter {
  const month = firstParam(params.month);
  const filter: TransactionFilter = {
    month: month !== undefined && MONTH_KEY.test(month) && month <= currentMonth ? month : currentMonth,
  };
  const envelopeId = idParam(params.envelopeId);
  const accountId = idParam(params.accountId);
  const cardId = accountId === undefined ? idParam(params.cardId) : undefined;
  if (envelopeId !== undefined) filter.envelopeId = envelopeId;
  if (accountId !== undefined) filter.accountId = accountId;
  if (cardId !== undefined) filter.cardId = cardId;
  return filter;
}

/** 거래 상세 라우트(`/transaction/[id]`)의 id. 양의 정수가 아니면 null — 라우트 파라미터는 믿지 않는다 */
export function parseTransactionId(value: string | string[] | undefined): number | null {
  const raw = firstParam(value);
  return raw !== undefined && POSITIVE_ID.test(raw) ? Number(raw) : null;
}

export function toSubcategories(dto: SubcategoryListDto): Subcategory[] {
  return dto.items.map((item) => ({ id: item.id, name: item.name, envelopeId: item.envelopeId, envelopeName: item.envelopeName }));
}

export function toClassifyResult(dto: ClassifyResponseDto): ClassifyResult {
  return {
    confirmStatus: pick(CONFIRM_STATUSES, dto.confirmStatus),
    envelopeId: dto.envelopeBalance.envelopeId,
    remaining: won(dto.envelopeBalance.remaining, "envelopeBalance.remaining"),
  };
}
