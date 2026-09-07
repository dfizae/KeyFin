import { toAccountSummary, type AccountSummaryDto } from "@/features/account/model";
import { ContractMismatchError } from "@/lib/contract";

const accountDto: AccountSummaryDto = {
  accountId: "acc_001",
  bankName: "하네스은행",
  alias: "생활비 통장",
  accountNumber: "110-123-456789",
  balance: "3469520",
};

describe("toAccountSummary", () => {
  it("계좌번호를 마스킹하고 잔액은 문자열 그대로 보관한다", () => {
    const summary = toAccountSummary(accountDto);
    expect(summary.maskedAccountNumber).toBe("110-***-**6789");
    expect(summary.balance).toBe("3469520");
    expect(summary.alias).toBe("생활비 통장");
  });

  it("잔액이 정수 문자열이 아니면 계약 불일치 오류를 던진다", () => {
    expect(() => toAccountSummary({ ...accountDto, balance: "3469520.50" })).toThrow(ContractMismatchError);
  });
});
