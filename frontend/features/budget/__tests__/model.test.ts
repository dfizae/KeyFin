import { budgetConfirmedMock, budgetProposalMock, budgetProposedMock } from "@/api/mocks/budget";
import { envelopeShortName } from "@/features/budget/catalog";
import {
  WARNING_REMAINING_RATE,
  budgetHealth,
  hasSpendingHistory,
  monthlyAvgPercent,
  sortByMonthlyAvg,
  envelopeHealth,
  sumAmounts,
  toBudget,
  toBudgetProposal,
  toConfirmRequest,
  usedPercent,
} from "@/features/budget/model";
import { ContractMismatchError } from "@/lib/contract";

describe("envelopeHealth · usedPercent · envelopeShortName", () => {
  it("봉투별 상태는 잔액·잔여율로 정하고 승인 전은 unset 이다", () => {
    const { envelopes } = toBudget(budgetConfirmedMock("202609"));
    expect(envelopes.map(envelopeHealth)).toEqual(["good", "good", "good", "warning", "over", "good", "good"]);
    expect(toBudget(budgetProposedMock("202609")).envelopes.map(envelopeHealth)).toEqual(Array(7).fill("unset"));
  });

  it("사용률은 100 − 잔여율이고 초과면 100 을 넘는다", () => {
    expect(usedPercent(36)).toBe(64);
    expect(usedPercent(-9)).toBe(109);
    expect(usedPercent(130)).toBe(0);
  });

  it("차트 축 이름은 카탈로그의 짧은 이름을 쓰고 모르는 id 는 서버 이름이다", () => {
    expect(envelopeShortName(6, "편의점·마트·잡화")).toBe("마트");
    expect(envelopeShortName(99, "새 봉투")).toBe("새 봉투");
  });
});

const MONTH = "202609";

describe("toBudget", () => {
  it("확정 월은 금액을 KRW 문자열로 바꾸고 잔여율은 서버 값을 그대로 둔다", () => {
    const budget = toBudget(budgetConfirmedMock(MONTH));
    expect(budget.month).toBe(MONTH);
    expect(budget.status).toBe("CONFIRMED");
    expect(budget.isConfirmed).toBe(true);
    expect(budget.total).toEqual({ confirmed: "500000", spent: "320000", remaining: "180000", remainingRate: 36 });
    expect(budget.envelopes).toHaveLength(7);
    expect(budget.envelopes[4]).toEqual({
      envelopeId: 5,
      name: "쇼핑",
      proposed: "90000",
      confirmed: "90000",
      spent: "98000",
      remaining: "-8000",
      remainingRate: -9,
    });
  });

  it("승인 전 월은 total 이 null 이고 봉투의 확정·잔액 필드도 null 을 유지한다", () => {
    const budget = toBudget(budgetProposedMock(MONTH));
    expect(budget.status).toBe("PROPOSED");
    expect(budget.isConfirmed).toBe(false);
    expect(budget.total).toBeNull();
    expect(budget.envelopes[0]).toMatchObject({ proposed: "100000", confirmed: null, spent: null, remaining: null, remainingRate: null });
  });

  it("모르는 status 는 UNKNOWN 으로 흡수한다", () => {
    expect(toBudget({ ...budgetProposedMock(MONTH), status: "ARCHIVED" }).status).toBe("UNKNOWN");
  });

  it("CONFIRMED 인데 total 이 비어 있으면 계약 불일치다", () => {
    const dto = budgetConfirmedMock(MONTH);
    expect(() => toBudget({ ...dto, total: { ...dto.total, remaining: null } })).toThrow(ContractMismatchError);
  });

  it("금액이 정수가 아니거나 잔여율이 정수가 아니거나 month 형식이 틀리면 계약 불일치다", () => {
    const dto = budgetConfirmedMock(MONTH);
    expect(() => toBudget({ ...dto, total: { ...dto.total, spent: 320000.5 } })).toThrow(ContractMismatchError);
    expect(() => toBudget({ ...dto, total: { ...dto.total, remainingRate: 36.4 } })).toThrow(ContractMismatchError);
    expect(() => toBudget({ ...dto, month: "2026-09" })).toThrow(ContractMismatchError);
    expect(() => toBudget({ ...dto, envelopes: [{ ...dto.envelopes[0], proposedAmount: Number.NaN }] })).toThrow(ContractMismatchError);
  });
});

describe("toBudgetProposal · sumAmounts · toConfirmRequest", () => {
  it("제안은 제안액과 근거 월평균을 KRW 문자열로 바꾼다", () => {
    const proposal = toBudgetProposal(budgetProposalMock(MONTH));
    expect(proposal.month).toBe(MONTH);
    expect(proposal.status).toBe("PROPOSED");
    expect(proposal.basis).toBe("최근 3개월 평균");
    expect(proposal.envelopes).toHaveLength(7);
    expect(proposal.envelopes[0]).toEqual({ envelopeId: 1, name: "외식", proposed: "100000", monthlyAvg: "112000" });
  });

  it("제안 합계는 500,000 이고 월평균 합계가 더 크다", () => {
    const { envelopes } = toBudgetProposal(budgetProposalMock(MONTH));
    expect(sumAmounts(envelopes.map((envelope) => envelope.proposed))).toBe("500000");
    expect(sumAmounts(envelopes.map((envelope) => envelope.monthlyAvg))).toBe("533000");
    expect(sumAmounts([])).toBe("0");
  });

  it("month·budgetId·금액이 계약과 다르면 계약 불일치다", () => {
    const dto = budgetProposalMock(MONTH);
    expect(() => toBudgetProposal({ ...dto, month: "2026-09" })).toThrow(ContractMismatchError);
    expect(() => toBudgetProposal({ ...dto, budgetId: 1.5 })).toThrow(ContractMismatchError);
    expect(() => toBudgetProposal({ ...dto, envelopes: [{ ...dto.envelopes[0], monthlyAvg: 92000.5 }] })).toThrow(
      ContractMismatchError
    );
  });

  it("승인 요청은 KRW 문자열을 원 정수로 되돌린다", () => {
    expect(toConfirmRequest([{ envelopeId: 1, amount: "120000" }])).toEqual({
      envelopes: [{ envelopeId: 1, amount: 120000 }],
    });
  });
});

describe("budgetHealth", () => {
  const base = { confirmed: "500000", spent: "320000" };

  it("남은 예산이 음수면 over, 잔여율이 30% 미만이면 warning, 나머지는 good", () => {
    expect(budgetHealth({ ...base, remaining: "180000", remainingRate: 36 })).toBe("good");
    expect(budgetHealth({ ...base, remaining: "100000", remainingRate: WARNING_REMAINING_RATE })).toBe("good");
    expect(budgetHealth({ ...base, remaining: "50000", remainingRate: WARNING_REMAINING_RATE - 1 })).toBe("warning");
    expect(budgetHealth({ ...base, remaining: "-1000", remainingRate: 0 })).toBe("over");
  });
});

describe("hasSpendingHistory · sortByMonthlyAvg · monthlyAvgPercent", () => {
  it("월평균이 하나라도 있으면 분석한 제안이고, 전부 0 이면 기본 템플릿 제안이다", () => {
    const dto = budgetProposalMock(MONTH);
    expect(hasSpendingHistory(toBudgetProposal(dto))).toBe(true);
    const template = { ...dto, basis: "기본 템플릿", envelopes: dto.envelopes.map((e) => ({ ...e, monthlyAvg: 0 })) };
    expect(hasSpendingHistory(toBudgetProposal(template))).toBe(false);
  });

  it("월평균이 큰 순으로 줄 세우고, 같으면 원래 봉투 순서를 지킨다", () => {
    const envelopes = [
      { envelopeId: 1, name: "외식", proposed: "0", monthlyAvg: "50000" },
      { envelopeId: 2, name: "교통비", proposed: "0", monthlyAvg: "90000" },
      { envelopeId: 3, name: "기타", proposed: "0", monthlyAvg: "50000" },
    ];
    expect(sortByMonthlyAvg(envelopes).map((e) => e.envelopeId)).toEqual([2, 1, 3]);
    expect(envelopes.map((e) => e.envelopeId)).toEqual([1, 2, 3]);
  });

  it("막대 길이는 가장 큰 값을 100 으로 본 정수 비율이고, 최댓값이 0 이면 0 이다", () => {
    expect(monthlyAvgPercent("120650", "120650")).toBe(100);
    expect(monthlyAvgPercent("84300", "120650")).toBe(69);
    expect(monthlyAvgPercent("0", "0")).toBe(0);
  });
});
