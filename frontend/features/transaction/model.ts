import { ContractMismatchError } from "@/lib/contract";
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
