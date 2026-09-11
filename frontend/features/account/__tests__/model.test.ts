import { createLinksMock, linkCandidatesMock, resetLinkMocks } from "@/api/mocks/link";
import {
  canSubmitIncomeAccount,
  linkedAccounts,
  linkedCards,
  totalBalance,
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
    createLinksMock({ accountIds: [3], cardIds: [1] });
    const options = toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()));
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ accountId: 3, bankCode: "090", bankName: "카카오뱅크" });
  });

  it("여러 계좌를 연결하면 후보 목록 순서대로 나온다", () => {
    createLinksMock({ accountIds: [3, 1], cardIds: [] });
    const options = toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()));
    expect(options.map((option) => option.bankName)).toEqual(["신한은행", "카카오뱅크"]);
  });

  it("카드만 연결했거나 연결된 계좌가 없으면 빈 목록이다", () => {
    expect(toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()))).toEqual([]);
    createLinksMock({ accountIds: [], cardIds: [1] });
    expect(toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()))).toEqual([]);
  });

  it("목록에 있는 계좌를 골랐을 때만 지정할 수 있다", () => {
    createLinksMock({ accountIds: [3], cardIds: [] });
    const options = toIncomeAccountOptions(toLinkCandidates(linkCandidatesMock()));
    expect(canSubmitIncomeAccount(options, null)).toBe(false);
    expect(canSubmitIncomeAccount(options, 999)).toBe(false);
    expect(canSubmitIncomeAccount(options, options[0].accountId)).toBe(true);
  });
});

describe("linkedAccounts · linkedCards · totalBalance", () => {
  beforeEach(resetLinkMocks);

  it("연결된 계좌·카드만 KeyFin id 를 달고, 총 자산은 연결 계좌 잔액 합계다", () => {
    createLinksMock({ accountIds: [1, 2], cardIds: [2] });
    const candidates = toLinkCandidates(linkCandidatesMock());
    const accounts = linkedAccounts(candidates);
    expect(accounts.map((account) => account.accountId)).toEqual([1, 2]);
    expect(linkedCards(candidates)).toEqual([expect.objectContaining({ cardId: 2, cardName: "노리 체크" })]);
    expect(totalBalance(accounts)).toBe("2768400");
  });

  it("연결 계좌가 없으면 총 자산은 0 원이다", () => {
    expect(totalBalance(linkedAccounts(toLinkCandidates(linkCandidatesMock())))).toBe("0");
  });
});
