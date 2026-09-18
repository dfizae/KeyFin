import { ApiError } from "@/api/error";
import type {
  BudgetDto,
  BudgetEnvelopeDto,
  BudgetProposalDto,
  ConfirmBudgetRequest,
  ConfirmBudgetResponseDto,
} from "@/features/budget/model";
import { currentDateKey } from "@/lib/date";

/**
 * 봉투 7종(고정 id 1~7)의 제안액과 목 지출액. 금액은 Pencil home/p0 (EWfx2) 예산 카드와 같다:
 * 총 500,000 중 320,000 사용, 180,000 남음(36%).
 */
const ENVELOPES: { envelopeId: number; name: string; proposedAmount: number; spent: number }[] = [
  { envelopeId: 1, name: "외식", proposedAmount: 100000, spent: 68000 },
  { envelopeId: 2, name: "교통비", proposedAmount: 60000, spent: 40000 },
  { envelopeId: 3, name: "의료·건강", proposedAmount: 40000, spent: 4000 },
  { envelopeId: 4, name: "취미·여가", proposedAmount: 70000, spent: 55000 },
  { envelopeId: 5, name: "쇼핑", proposedAmount: 90000, spent: 98000 },
  { envelopeId: 6, name: "편의점·마트·잡화", proposedAmount: 80000, spent: 40000 },
  { envelopeId: 7, name: "기타", proposedAmount: 60000, spent: 15000 },
];

/**
 * 최근 3개월 월평균. 합계 533,000 으로 제안 합계(500,000)보다 크다 — "분석해서 줄여 제안했다" 는 흐름이 화면에 보이게 한 값이다.
 * (Pencil budget-proposal g1fhiV 시안과 같은 수치)
 */
const MONTHLY_AVG: Record<number, number> = { 1: 112000, 2: 62000, 3: 38000, 4: 74000, 5: 105000, 6: 84000, 7: 58000 };

const MOCK_BUDGET_ID = 1;

/** 목 사용자의 기준일은 1일 — 주기 = 이번 달 1일~말일 */
function mockPeriod(todayKey: string): { month: string; periodFrom: string; periodTo: string } {
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = todayKey.slice(0, 7);
  return { month: `${year}${todayKey.slice(5, 7)}`, periodFrom: `${prefix}-01`, periodTo: `${prefix}-${lastDay}` };
}

/** 서버처럼 잔여율은 remaining × 100 ÷ confirmed 정수 내림(초과면 음수), 확정액 0 이면 null */
function rateOf(remaining: number, confirmed: number): number | null {
  return confirmed === 0 ? null : Math.floor((remaining * 100) / confirmed);
}

/** 비상금은 아직 설정 화면(P1)이 없어 미설정으로 둔다 — amount 0 이면 서버도 미설정으로 본다 */
const EMERGENCY_UNSET = { amount: 0, spent: 0, remaining: 0 };

/** 확정 예산 응답 예시(노션 예산·잔액 조회 CONFIRMED). amounts 가 없으면 제안액을 그대로 확정한 것으로 본다 */
export function budgetConfirmedMock(todayKey: string, amounts?: Record<number, number>): BudgetDto {
  const envelopes: BudgetEnvelopeDto[] = ENVELOPES.map(({ envelopeId, name, proposedAmount, spent }) => {
    const confirmed = amounts?.[envelopeId] ?? proposedAmount;
    const remaining = confirmed - spent;
    return { envelopeId, name, proposedAmount: null, confirmedAmount: confirmed, spent, remaining, remainingRate: rateOf(remaining, confirmed) };
  });
  const confirmed = envelopes.reduce((sum, envelope) => sum + (envelope.confirmedAmount ?? 0), 0);
  const spent = ENVELOPES.reduce((sum, envelope) => sum + envelope.spent, 0);
  return {
    budgetId: MOCK_BUDGET_ID,
    ...mockPeriod(todayKey),
    status: "CONFIRMED",
    total: { confirmed, spent, remaining: confirmed - spent, remainingRate: rateOf(confirmed - spent, confirmed) },
    envelopes,
    emergency: EMERGENCY_UNSET,
  };
}

/** 확정 전 예산 응답 예시(노션 예산·잔액 조회 PROPOSED): total=null, 봉투는 제안액만 */
export function budgetProposedMock(todayKey: string): BudgetDto {
  return {
    budgetId: MOCK_BUDGET_ID,
    ...mockPeriod(todayKey),
    status: "PROPOSED",
    total: null,
    envelopes: ENVELOPES.map(({ envelopeId, name, proposedAmount }) => ({
      envelopeId,
      name,
      proposedAmount,
      confirmedAmount: null,
      spent: null,
      remaining: null,
      remainingRate: null,
    })),
    emergency: EMERGENCY_UNSET,
  };
}

/** POST /budgets/proposals 응답 예시 (노션 예산 제안 생성) */
export function budgetProposalMock(month: string): BudgetProposalDto {
  return {
    budgetId: MOCK_BUDGET_ID,
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

/**
 * 앱이 도는 동안만 유지되는 이번 주기 예산. 서버처럼 움직인다:
 * 제안은 주기당 한 번(두 번째는 409 BUDGET_001), 조회는 없으면 제안을 만들어 PROPOSED, 확정은 한 번(두 번째는 409 BUDGET_003).
 */
let currentBudget: { status: "PROPOSED" | "CONFIRMED"; amounts?: Record<number, number> } | null = null;

export function createProposalMock(month: string): BudgetProposalDto {
  if (currentBudget !== null) throw new ApiError(409, "BUDGET_001", "해당 월의 예산이 이미 존재합니다.");
  currentBudget = { status: "PROPOSED" };
  return budgetProposalMock(month);
}

export function currentBudgetMock(todayKey: string = currentDateKey()): BudgetDto {
  if (currentBudget === null) currentBudget = { status: "PROPOSED" };
  return currentBudget.status === "CONFIRMED" ? budgetConfirmedMock(todayKey, currentBudget.amounts) : budgetProposedMock(todayKey);
}

export function confirmBudgetMock(budgetId: number, request: ConfirmBudgetRequest, todayKey: string = currentDateKey()): ConfirmBudgetResponseDto {
  if (budgetId !== MOCK_BUDGET_ID || currentBudget === null) throw new ApiError(404, "BUDGET_002", "예산을 찾을 수 없습니다.");
  if (currentBudget.status === "CONFIRMED") throw new ApiError(409, "BUDGET_003", "이미 확정된 예산은 변경할 수 없습니다.");
  currentBudget = { status: "CONFIRMED", amounts: Object.fromEntries(request.envelopes.map((e) => [e.envelopeId, e.amount])) };
  return { budgetId, month: mockPeriod(todayKey).month, status: "CONFIRMED" };
}

/** 온보딩을 마친 사용자로 시작할 때: 이번 주기 예산이 제안액 그대로 확정된 상태 */
export function seedConfirmedBudgetMock(): void {
  currentBudget = { status: "CONFIRMED" };
}

/** 테스트·개발 재시작용 */
export function resetBudgetMocks(): void {
  currentBudget = null;
}
