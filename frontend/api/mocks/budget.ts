import type { BudgetDto, BudgetEnvelopeDto, BudgetProposalDto, ConfirmBudgetResponseDto } from "@/features/budget/model";
import { currentMonthKey } from "@/lib/date";

/**
 * GET /budgets/{month} 응답 예시 (docs/api-contract.md BUDGET).
 * 봉투 7종은 고정 id 1~7. 금액은 Pencil home/p0 (EWfx2) 의 예산 카드와 같다: 총 500,000 중 320,000 사용, 180,000 남음(36%).
 */
const ENVELOPES: BudgetEnvelopeDto[] = [
  { envelopeId: 1, name: "외식", proposedAmount: 100000, confirmedAmount: 100000, spent: 68000, remaining: 32000, remainingRate: 32 },
  { envelopeId: 2, name: "교통비", proposedAmount: 60000, confirmedAmount: 60000, spent: 40000, remaining: 20000, remainingRate: 33 },
  { envelopeId: 3, name: "의료·건강", proposedAmount: 40000, confirmedAmount: 40000, spent: 4000, remaining: 36000, remainingRate: 90 },
  { envelopeId: 4, name: "취미·여가", proposedAmount: 70000, confirmedAmount: 70000, spent: 55000, remaining: 15000, remainingRate: 21 },
  { envelopeId: 5, name: "쇼핑", proposedAmount: 90000, confirmedAmount: 90000, spent: 98000, remaining: -8000, remainingRate: -9 },
  { envelopeId: 6, name: "편의점·마트·잡화", proposedAmount: 80000, confirmedAmount: 80000, spent: 40000, remaining: 40000, remainingRate: 50 },
  { envelopeId: 7, name: "기타", proposedAmount: 60000, confirmedAmount: 60000, spent: 15000, remaining: 45000, remainingRate: 75 },
];

export function budgetConfirmedMock(month: string): BudgetDto {
  return {
    month,
    status: "CONFIRMED",
    total: { confirmed: 500000, spent: 320000, remaining: 180000, remainingRate: 36 },
    envelopes: ENVELOPES,
  };
}

/** 승인 전 월: status=PROPOSED 이고 total·확정액·잔액 필드는 null (계약 사본 BUDGET 설명) */
export function budgetProposedMock(month: string): BudgetDto {
  return {
    month,
    status: "PROPOSED",
    total: { confirmed: null, spent: null, remaining: null, remainingRate: null },
    envelopes: ENVELOPES.map((envelope) => ({
      ...envelope,
      confirmedAmount: null,
      spent: null,
      remaining: null,
      remainingRate: null,
    })),
  };
}

/** 목 모드에서 홈이 받는 값. 미승인 상태를 보려면 budgetProposedMock 으로 바꾼다. */
export const budgetMock = budgetConfirmedMock;

/**
 * 최근 3개월 월평균. 합계 533,000 으로 제안 합계(500,000)보다 크다 — "분석해서 줄여 제안했다" 는 흐름이 화면에 보이게 한 값이다.
 * (Pencil budget-proposal g1fhiV 시안과 같은 수치)
 */
const MONTHLY_AVG: Record<number, number> = {
  1: 112000,
  2: 62000,
  3: 38000,
  4: 74000,
  5: 105000,
  6: 84000,
  7: 58000,
};

/** POST /budgets/proposals 응답 예시 (docs/api-contract.md BUDGET). */
export function budgetProposalMock(month: string): BudgetProposalDto {
  return {
    budgetId: 1,
    month,
    status: "PROPOSED",
    basis: "최근 3개월 평균",
    envelopes: ENVELOPES.map(({ envelopeId, name, proposedAmount }) => ({
      envelopeId,
      name,
      proposedAmount,
      monthlyAvg: MONTHLY_AVG[envelopeId] ?? proposedAmount,
    })),
  };
}

/** PUT /budgets/{budgetId}/confirm 응답 */
export function confirmBudgetMock(budgetId: number): ConfirmBudgetResponseDto {
  return { budgetId, month: currentMonthKey(), status: "CONFIRMED" };
}
