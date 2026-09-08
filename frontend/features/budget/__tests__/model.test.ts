import { budgetConfirmedMock, budgetProposedMock } from "@/api/mocks/budget";
import { envelopeShortName } from "@/features/budget/catalog";
import { WARNING_REMAINING_RATE, budgetHealth, envelopeHealth, toBudget, usedPercent } from "@/features/budget/model";
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

describe("budgetHealth", () => {
  const base = { confirmed: "500000", spent: "320000" };

  it("남은 예산이 음수면 over, 잔여율이 30% 미만이면 warning, 나머지는 good", () => {
    expect(budgetHealth({ ...base, remaining: "180000", remainingRate: 36 })).toBe("good");
    expect(budgetHealth({ ...base, remaining: "100000", remainingRate: WARNING_REMAINING_RATE })).toBe("good");
    expect(budgetHealth({ ...base, remaining: "50000", remainingRate: WARNING_REMAINING_RATE - 1 })).toBe("warning");
    expect(budgetHealth({ ...base, remaining: "-1000", remainingRate: 0 })).toBe("over");
  });
});
