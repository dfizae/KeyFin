import { ContractMismatchError, toHomeSummary } from "@/features/account/model";
import { homeSummaryMock } from "@/api/mocks/home";

describe("toHomeSummary", () => {
  it("계좌번호를 마스킹하고 잔액은 문자열 그대로 보관한다", () => {
    const summary = toHomeSummary(homeSummaryMock);
    expect(summary.primaryAccount?.maskedAccountNumber).toBe("110-***-**6789");
    expect(summary.primaryAccount?.balance).toBe("3469520");
    expect(summary.userName).toBe("김재영");
  });

  it("계좌가 없으면 null을 유지한다", () => {
    expect(toHomeSummary({ ...homeSummaryMock, primaryAccount: null }).primaryAccount).toBeNull();
  });

  it("잔액이 정수 문자열이 아니면 계약 불일치 오류를 던진다", () => {
    const dto = {
      ...homeSummaryMock,
      primaryAccount: { ...homeSummaryMock.primaryAccount!, balance: "3469520.50" },
    };
    expect(() => toHomeSummary(dto)).toThrow(ContractMismatchError);
  });
});
