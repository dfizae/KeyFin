import { homeSummaryMock } from "@/api/mocks/home";
import { toHomeSummary, toMonthlyBudget } from "@/features/home/model";
import { ContractMismatchError } from "@/lib/contract";

describe("toMonthlyBudget", () => {
  it("남은 예산과 사용 비율을 계산하고 70% 미만이면 good 이다", () => {
    const budget = toMonthlyBudget({ total: "500000", spent: "320000" });
    expect(budget.remaining).toBe("180000");
    expect(budget.usedRatio).toBeCloseTo(0.64);
    expect(budget.status).toBe("good");
  });

  it("70% 이상이면 warning, 예산을 넘기면 over 이고 남은 예산은 음수 문자열이다", () => {
    expect(toMonthlyBudget({ total: "500000", spent: "400000" }).status).toBe("warning");

    const over = toMonthlyBudget({ total: "500000", spent: "600000" });
    expect(over.status).toBe("over");
    expect(over.remaining).toBe("-100000");
    expect(over.usedRatio).toBe(1);
  });

  it("총 예산이 0이면 사용 비율은 0 또는 1로 처리한다", () => {
    expect(toMonthlyBudget({ total: "0", spent: "0" }).usedRatio).toBe(0);
    expect(toMonthlyBudget({ total: "0", spent: "1000" }).usedRatio).toBe(1);
  });

  it("금액이 정수 문자열이 아니면 계약 불일치 오류를 던진다", () => {
    expect(() => toMonthlyBudget({ total: "500000.5", spent: "0" })).toThrow(ContractMismatchError);
    expect(() => toMonthlyBudget({ total: "500000", spent: "abc" })).toThrow(ContractMismatchError);
  });
});

describe("toHomeSummary", () => {
  it("사용자 이름·코인·캐릭터·예산을 화면 모델로 변환한다", () => {
    const summary = toHomeSummary(homeSummaryMock);
    expect(summary.userName).toBe("김재영");
    expect(summary.coinBalance).toBe(1250);
    expect(summary.character).toEqual({ characterId: "chr_001", name: "키핀" });
    expect(summary.monthlyBudget?.remaining).toBe("180000");
  });

  it("캐릭터와 예산이 없으면 null 을 유지한다", () => {
    const summary = toHomeSummary({ ...homeSummaryMock, character: null, monthlyBudget: null });
    expect(summary.character).toBeNull();
    expect(summary.monthlyBudget).toBeNull();
  });

  it("코인 잔액이 음수이거나 정수가 아니면 계약 불일치 오류를 던진다", () => {
    expect(() => toHomeSummary({ ...homeSummaryMock, coinBalance: -1 })).toThrow(ContractMismatchError);
    expect(() => toHomeSummary({ ...homeSummaryMock, coinBalance: 1.5 })).toThrow(ContractMismatchError);
  });
});
