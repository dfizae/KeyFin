import { ContractMismatchError } from "@/lib/contract";
import { addKRW, compareKRW, fromServerWon, toWon, type KRW } from "@/lib/money";

/**
 * GET /budgets/{month} 계약 (docs/api-contract.md BUDGET).
 * 잔액·잔여율은 서버 파생값이라 검증만 하고 다시 계산하지 않는다. 미승인 월은 status=PROPOSED 이고 total·확정 필드가 null 이다.
 */
export type BudgetStatus = "PROPOSED" | "CONFIRMED" | "UNKNOWN";

export type BudgetEnvelopeDto = {
  envelopeId: number;
  name: string;
  proposedAmount: number;
  confirmedAmount: number | null;
  spent: number | null;
  remaining: number | null;
  /** 정수 % */
  remainingRate: number | null;
};

export type BudgetTotalDto = {
  confirmed: number | null;
  spent: number | null;
  remaining: number | null;
  remainingRate: number | null;
};

export type BudgetDto = {
  month: string;
  status: string;
  total: BudgetTotalDto;
  envelopes: BudgetEnvelopeDto[];
  emergency?: { amount: number; spent: number; remaining: number };
};

export type BudgetEnvelope = {
  envelopeId: number;
  name: string;
  proposed: KRW;
  confirmed: KRW | null;
  spent: KRW | null;
  remaining: KRW | null;
  remainingRate: number | null;
};

export type BudgetTotal = {
  confirmed: KRW;
  spent: KRW;
  remaining: KRW;
  remainingRate: number;
};

export type Budget = {
  month: string;
  status: BudgetStatus;
  isConfirmed: boolean;
  /** 승인 전이면 null */
  total: BudgetTotal | null;
  envelopes: BudgetEnvelope[];
};

/** 화면 표시용 상태. over = 남은 예산 음수, warning = 잔여율 30% 미만(잔액 구간 알림 30% 와 같은 기준), good = 나머지 */
export type BudgetHealth = "good" | "warning" | "over";

export const WARNING_REMAINING_RATE = 30;

const MONTH_KEY = /^\d{6}$/;

function won(value: number, field: string): KRW {
  try {
    return fromServerWon(value);
  } catch {
    throw new ContractMismatchError(field);
  }
}

function optionalWon(value: number | null, field: string): KRW | null {
  return value === null ? null : won(value, field);
}

function requiredRate(value: number, field: string): number {
  if (!Number.isInteger(value)) throw new ContractMismatchError(field);
  return value;
}

function optionalRate(value: number | null, field: string): number | null {
  return value === null ? null : requiredRate(value, field);
}

function toStatus(raw: string): BudgetStatus {
  return raw === "PROPOSED" || raw === "CONFIRMED" ? raw : "UNKNOWN";
}

function toTotal(dto: BudgetTotalDto): BudgetTotal | null {
  if (dto.confirmed === null || dto.spent === null || dto.remaining === null || dto.remainingRate === null) return null;
  return {
    confirmed: won(dto.confirmed, "total.confirmed"),
    spent: won(dto.spent, "total.spent"),
    remaining: won(dto.remaining, "total.remaining"),
    remainingRate: requiredRate(dto.remainingRate, "total.remainingRate"),
  };
}

export function toBudget(dto: BudgetDto): Budget {
  if (!MONTH_KEY.test(dto.month)) throw new ContractMismatchError("month");
  const status = toStatus(dto.status);
  const total = toTotal(dto.total);
  if (status === "CONFIRMED" && total === null) throw new ContractMismatchError("total");

  return {
    month: dto.month,
    status,
    isConfirmed: status === "CONFIRMED",
    total,
    envelopes: dto.envelopes.map((envelope) => ({
      envelopeId: envelope.envelopeId,
      name: envelope.name,
      proposed: won(envelope.proposedAmount, "envelopes.proposedAmount"),
      confirmed: optionalWon(envelope.confirmedAmount, "envelopes.confirmedAmount"),
      spent: optionalWon(envelope.spent, "envelopes.spent"),
      remaining: optionalWon(envelope.remaining, "envelopes.remaining"),
      remainingRate: optionalRate(envelope.remainingRate, "envelopes.remainingRate"),
    })),
  };
}

export function budgetHealth(total: BudgetTotal): BudgetHealth {
  if (compareKRW(total.remaining, "0") < 0) return "over";
  if (total.remainingRate < WARNING_REMAINING_RATE) return "warning";
  return "good";
}

/** 봉투별 상태. 승인 전(잔액 null)은 unset */
export type EnvelopeHealth = BudgetHealth | "unset";

export function envelopeHealth(envelope: BudgetEnvelope): EnvelopeHealth {
  if (envelope.remaining === null || envelope.remainingRate === null) return "unset";
  if (compareKRW(envelope.remaining, "0") < 0) return "over";
  if (envelope.remainingRate < WARNING_REMAINING_RATE) return "warning";
  return "good";
}

/** 서버 잔여율(%)을 사용률(%)로 바꾼다. 초과면 100 을 넘는다 — 막대 길이는 호출부가 100 으로 자른다. */
export function usedPercent(remainingRate: number): number {
  return Math.max(0, 100 - remainingRate);
}

/**
 * POST /budgets/proposals 계약 (docs/api-contract.md BUDGET, FR-USR-04·FR-BGT-01).
 * 조회(GET /budgets/{month})와 달리 봉투마다 근거인 monthlyAvg 가 온다 — 승인 화면(PAGE-07)이 이걸 쓴다.
 */
export type BudgetProposalEnvelopeDto = {
  envelopeId: number;
  name: string;
  proposedAmount: number;
  /** 최근 3개월 월평균 소비 */
  monthlyAvg: number;
  adjustment?: number;
};

export type BudgetProposalDto = {
  budgetId: number;
  month: string;
  status: string;
  /** 제안 근거 문구. 이력이 없으면 기본 템플릿 폴백 */
  basis: string;
  envelopes: BudgetProposalEnvelopeDto[];
};

export type BudgetProposalEnvelope = {
  envelopeId: number;
  name: string;
  proposed: KRW;
  monthlyAvg: KRW;
};

export type BudgetProposal = {
  budgetId: number;
  month: string;
  status: BudgetStatus;
  basis: string;
  envelopes: BudgetProposalEnvelope[];
};

export function toBudgetProposal(dto: BudgetProposalDto): BudgetProposal {
  if (!MONTH_KEY.test(dto.month)) throw new ContractMismatchError("month");
  if (!Number.isInteger(dto.budgetId)) throw new ContractMismatchError("budgetId");

  return {
    budgetId: dto.budgetId,
    month: dto.month,
    status: toStatus(dto.status),
    basis: dto.basis,
    envelopes: dto.envelopes.map((envelope) => ({
      envelopeId: envelope.envelopeId,
      name: envelope.name,
      proposed: won(envelope.proposedAmount, "envelopes.proposedAmount"),
      monthlyAvg: won(envelope.monthlyAvg, "envelopes.monthlyAvg"),
    })),
  };
}

/** PUT /budgets/{budgetId}/confirm 요청. 봉투 7개를 전부 보낸다(구성이 다르면 400 BUDGET_004) */
export type ConfirmBudgetRequest = {
  envelopes: { envelopeId: number; amount: number }[];
};

export type ConfirmBudgetResponseDto = { budgetId: number; month: string; status: string };

/** 화면의 KRW 문자열 금액을 서버가 받는 원 정수로 되돌린다 */
export function toConfirmRequest(entries: { envelopeId: number; amount: KRW }[]): ConfirmBudgetRequest {
  return {
    envelopes: entries.map(({ envelopeId, amount }) => ({ envelopeId, amount: Number(toWon(amount)) })),
  };
}

/** 봉투 금액 합계. 빈 목록은 0 원이다 */
export function sumAmounts(amounts: KRW[]): KRW {
  return amounts.length === 0 ? "0" : addKRW(...amounts);
}
