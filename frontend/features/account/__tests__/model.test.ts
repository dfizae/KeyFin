import { createLinksMock, linkCandidatesMock, resetLinkMocks } from "@/api/mocks/link";
import {
  canSubmitIncomeAccount,
  toAccountSummary,
  toIncomeAccountOptions,
  type AccountSummaryDto,
} from "@/features/account/model";
import { toLinkCandidates } from "@/features/link/model";
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

describe("toIncomeAccountOptions · canSubmitIncomeAccount", () => {
  beforeEach(resetLinkMocks);

  it("연결된 계좌만 KeyFin id 를 달고 선택지가 된다", () => {
    const options = toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()));
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ accountId: 3, bankCode: "090", bankName: "카카오뱅크" });
  });

  it("방금 연결한 계좌도 선택지에 들어온다", () => {
    createLinksMock({ accountIds: [1], cardIds: [] });
    const options = toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()));
    expect(options.map((option) => option.bankName)).toEqual(["신한은행", "카카오뱅크"]);
  });

  it("카드만 연결했거나 연결된 계좌가 없으면 빈 목록이다", () => {
    const candidates = toLinkCandidates(linkCandidatesMock());
    const noLinkedAccounts = { ...candidates, accounts: candidates.accounts.filter((account) => !account.linked) };
    expect(toIncomeAccountOptions(noLinkedAccounts)).toEqual([]);
  });

  it("목록에 있는 계좌를 골랐을 때만 지정할 수 있다", () => {
    const options = toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()));
    expect(canSubmitIncomeAccount(options, null)).toBe(false);
    expect(canSubmitIncomeAccount(options, 999)).toBe(false);
    expect(canSubmitIncomeAccount(options, options[0].accountId)).toBe(true);
  });
});
