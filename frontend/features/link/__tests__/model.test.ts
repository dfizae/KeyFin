import { ApiError } from "@/api/error";
import { ContractMismatchError } from "@/lib/contract";
import {
  connectFinanceMock,
  createLinksMock,
  financeStatusMock,
  linkCandidatesMock,
  MOCK_FINANCE_EMAIL,
  MOCK_TAKEN_FINANCE_EMAIL,
  resetLinkMocks,
} from "@/api/mocks/link";
import { financeErrorMessage, isRetryableFinanceError } from "@/features/link/errors";
import {
  areAllLinksSelected,
  canSubmitFinanceEmail,
  canSubmitLinks,
  countLinkRequest,
  linkCtaAction,
  FINANCE_EMAIL_MAX_LENGTH,
  hasNoLinkCandidates,
  isLinkSelectable,
  selectableLinkIds,
  toggleLinkSelection,
  toggleSelectAllLinks,
  toLinkCandidates,
  toLinkRequest,
} from "@/features/link/model";

beforeEach(resetLinkMocks);

describe("canSubmitFinanceEmail", () => {
  it("이메일 형식이고 100자 이하여야 보낼 수 있다", () => {
    expect(canSubmitFinanceEmail(MOCK_FINANCE_EMAIL)).toBe(true);
    expect(canSubmitFinanceEmail("  finance@qwer.com  ")).toBe(true);
    expect(canSubmitFinanceEmail("finance@qwer")).toBe(false);
    expect(canSubmitFinanceEmail("")).toBe(false);
  });

  it("100자를 넘으면 서버 COMMON_001 전에 막는다", () => {
    const long = `${"a".repeat(FINANCE_EMAIL_MAX_LENGTH)}@qwer.com`;
    expect(long.length).toBeGreaterThan(FINANCE_EMAIL_MAX_LENGTH);
    expect(canSubmitFinanceEmail(long)).toBe(false);
  });
});

describe("connectFinanceMock", () => {
  it("금융망에 있는 이메일이면 연결된다", () => {
    expect(connectFinanceMock({ financeEmail: MOCK_FINANCE_EMAIL })).toEqual({ connected: true });
  });

  it("없는 회원은 FINANCE_001, 이미 연결된 계정은 LINK_001 이다", () => {
    expect(() => connectFinanceMock({ financeEmail: "nobody@qwer.com" })).toThrow(ApiError);
    try {
      connectFinanceMock({ financeEmail: "nobody@qwer.com" });
    } catch (error) {
      expect((error as ApiError).code).toBe("FINANCE_001");
    }
    try {
      connectFinanceMock({ financeEmail: MOCK_TAKEN_FINANCE_EMAIL });
    } catch (error) {
      expect((error as ApiError).code).toBe("LINK_001");
      expect((error as ApiError).status).toBe(409);
    }
  });
});

describe("financeErrorMessage · isRetryableFinanceError", () => {
  it("확인된 code 는 정해진 문구를 쓰고 모르는 code 는 서버 message 를 쓴다", () => {
    expect(financeErrorMessage(new ApiError(409, "LINK_001", "무시됨"))).toContain("다른 KeyFin 계정");
    expect(financeErrorMessage(new ApiError(500, "COMMON_006", "서버 내부 오류가 발생했습니다."))).toBe(
      "서버 내부 오류가 발생했습니다."
    );
  });

  it("이미 연결됐거나 없는 회원은 다시 눌러도 소용없다", () => {
    expect(isRetryableFinanceError(new ApiError(404, "FINANCE_001", ""))).toBe(false);
    expect(isRetryableFinanceError(new ApiError(409, "LINK_001", ""))).toBe(false);
    expect(isRetryableFinanceError(new ApiError(503, "FINANCE_004", ""))).toBe(true);
  });
});

describe("financeStatusMock", () => {
  it("연결 전에는 false, 연결에 성공하면 true 다", () => {
    expect(financeStatusMock()).toEqual({ connected: false });
    connectFinanceMock({ financeEmail: MOCK_FINANCE_EMAIL });
    expect(financeStatusMock()).toEqual({ connected: true });
  });

  it("연결에 실패하면 상태는 그대로 false 다", () => {
    expect(() => connectFinanceMock({ financeEmail: MOCK_TAKEN_FINANCE_EMAIL })).toThrow();
    expect(financeStatusMock()).toEqual({ connected: false });
  });
});

describe("toLinkCandidates", () => {
  it("계좌번호·카드번호를 마스킹하고 잔액을 KRW 로 바꾼다", () => {
    const candidates = toLinkCandidates(linkCandidatesMock());
    const shinhan = candidates.accounts[0];
    expect(shinhan.finAccountNo).toBe("0885401234567890");
    expect(shinhan.maskedNo).toBe("088*********7890");
    expect(shinhan.balance).toBe("2450000");
    expect(candidates.cards[0].maskedNo).toBe("5310********1234");
  });

  it("출금 계좌번호도 마스킹해 둔다", () => {
    const card = toLinkCandidates(linkCandidatesMock()).cards[0];
    expect(card.maskedWithdrawalNo).toBe("088*********7890");
  });

  it("잔액이 정수가 아니면 계약 불일치로 막는다", () => {
    const dto = linkCandidatesMock();
    dto.accounts[0].balance = 1234.5;
    expect(() => toLinkCandidates(dto)).toThrow(ContractMismatchError);
  });

  it("계좌번호가 비어 있으면 계약 불일치로 막는다", () => {
    const dto = linkCandidatesMock();
    dto.accounts[0].finAccountNo = "";
    expect(() => toLinkCandidates(dto)).toThrow(ContractMismatchError);
  });

  it("처음에는 전부 미선택이고, 연결 여부와 무관하게 KeyFin id 를 들고 있다", () => {
    const { accounts, cards } = toLinkCandidates(linkCandidatesMock());
    expect([...accounts, ...cards].some((item) => item.linked)).toBe(false);
    expect(accounts.map((a) => a.id)).toEqual([1, 2, 3, 4]);
    expect(cards.map((c) => c.id)).toEqual([1, 2]);
  });

  it("managed 를 linked 로 옮긴다", () => {
    createLinksMock({ accountIds: [3], cardIds: [] });
    const { accounts } = toLinkCandidates(linkCandidatesMock());
    expect(accounts.filter((a) => a.linked)).toEqual([expect.objectContaining({ id: 3, bankName: "카카오뱅크" })]);
  });

  it("id 가 양의 정수가 아니면 계약 불일치로 막는다", () => {
    const dto = linkCandidatesMock();
    dto.cards[0].id = 0;
    expect(() => toLinkCandidates(dto)).toThrow(ContractMismatchError);
  });
});

describe("toggleLinkSelection", () => {
  it("없으면 넣고 있으면 뺀다", () => {
    const once = toggleLinkSelection(new Set(), "a");
    expect([...once]).toEqual(["a"]);
    expect([...toggleLinkSelection(once, "a")]).toEqual([]);
  });

  it("원본을 바꾸지 않는다", () => {
    const before = new Set(["a"]);
    toggleLinkSelection(before, "b");
    expect([...before]).toEqual(["a"]);
  });
});

describe("toLinkRequest · canSubmitLinks", () => {
  it("선택한 계좌·카드를 KeyFin id 목록으로 나눠 담는다", () => {
    const candidates = toLinkCandidates(linkCandidatesMock());
    const request = toLinkRequest(candidates, new Set(["0885401234567890", "5310123412341234"]));
    expect(request).toEqual({ accountIds: [1], cardIds: [1] });
    expect(countLinkRequest(request)).toBe(2);
    expect(canSubmitLinks(request)).toBe(true);
  });

  it("이미 연결된 항목은 골라도 요청에 넣지 않는다", () => {
    createLinksMock({ accountIds: [3], cardIds: [] });
    const candidates = toLinkCandidates(linkCandidatesMock());
    const linked = candidates.accounts.find((a) => a.linked);
    expect(linked).toBeDefined();
    const request = toLinkRequest(candidates, new Set([linked!.finAccountNo]));
    expect(request).toEqual({ accountIds: [], cardIds: [] });
    expect(canSubmitLinks(request)).toBe(false);
  });

  it("후보에 없는 번호는 무시한다", () => {
    const request = toLinkRequest(toLinkCandidates(linkCandidatesMock()), new Set(["없는번호"]));
    expect(canSubmitLinks(request)).toBe(false);
  });
});

describe("isLinkSelectable · hasNoLinkCandidates", () => {
  it("연결된 항목은 고를 수 없다", () => {
    expect(isLinkSelectable({ linked: false })).toBe(true);
    expect(isLinkSelectable({ linked: true })).toBe(false);
  });

  it("계좌·카드가 모두 없을 때만 빈 상태다", () => {
    expect(hasNoLinkCandidates(toLinkCandidates(linkCandidatesMock()))).toBe(false);
    expect(hasNoLinkCandidates({ accounts: [], cards: [] })).toBe(true);
  });
});

describe("createLinksMock", () => {
  it("새로 연결된 수만 센다 — 다시 보내도 0 이다(멱등)", () => {
    const request = { accountIds: [1], cardIds: [1] };
    expect(createLinksMock(request)).toEqual({ accounts: 1, cards: 1 });
    expect(createLinksMock(request)).toEqual({ accounts: 0, cards: 0 });
  });

  it("연결한 항목은 후보 목록에서 managed 로 바뀐다", () => {
    createLinksMock({ accountIds: [2], cardIds: [] });
    const account = linkCandidatesMock().accounts.find((a) => a.finAccountNo === "0041202345678901");
    expect(account?.managed).toBe(true);
  });
});

describe("selectableLinkIds · areAllLinksSelected · toggleSelectAllLinks", () => {
  it("전체 선택은 이미 연결된 항목을 빼고 고른다", () => {
    createLinksMock({ accountIds: [3], cardIds: [] });
    const candidates = toLinkCandidates(linkCandidatesMock());
    const linked = candidates.accounts.find((account) => account.linked);
    expect(linked).toBeDefined();

    const ids = selectableLinkIds(candidates);
    expect(ids).not.toContain(linked!.finAccountNo);
    expect(ids).toHaveLength(candidates.accounts.length + candidates.cards.length - 1);

    const selected = toggleSelectAllLinks(candidates, new Set());
    expect(areAllLinksSelected(candidates, selected)).toBe(true);
    const request = toLinkRequest(candidates, selected);
    expect(request.accountIds).toHaveLength(candidates.accounts.length - 1);
    expect(request.cardIds).toHaveLength(candidates.cards.length);
  });

  it("일부만 고른 상태에서 누르면 나머지가 채워진다", () => {
    const candidates = toLinkCandidates(linkCandidatesMock());
    const partial = new Set([selectableLinkIds(candidates)[0]]);
    expect(areAllLinksSelected(candidates, partial)).toBe(false);
    expect(areAllLinksSelected(candidates, toggleSelectAllLinks(candidates, partial))).toBe(true);
  });

  it("전부 고른 상태에서 다시 누르면 전부 푼다", () => {
    const candidates = toLinkCandidates(linkCandidatesMock());
    const all = toggleSelectAllLinks(candidates, new Set());
    expect(toggleSelectAllLinks(candidates, all).size).toBe(0);
  });

  it("고를 수 있는 항목이 없으면 전체 선택된 상태로 보지 않는다", () => {
    expect(areAllLinksSelected({ accounts: [], cards: [] }, new Set())).toBe(false);
  });
});

describe("linkCtaAction", () => {
  it("연결된 것도 고른 것도 없으면 누를 수 없다", () => {
    const candidates = toLinkCandidates(linkCandidatesMock());
    expect(linkCtaAction(candidates, toLinkRequest(candidates, new Set()))).toBe("none");
  });

  it("새로 고른 항목이 있으면 연결한다", () => {
    const candidates = toLinkCandidates(linkCandidatesMock());
    expect(linkCtaAction(candidates, toLinkRequest(candidates, new Set(["0885401234567890"])))).toBe("link");
  });

  it("이미 연결된 항목이 있고 새로 고른 게 없으면 그대로 다음 단계로 간다", () => {
    createLinksMock({ accountIds: [], cardIds: [2] });
    const candidates = toLinkCandidates(linkCandidatesMock());
    expect(linkCtaAction(candidates, toLinkRequest(candidates, new Set()))).toBe("next");
  });

  it("이미 연결된 항목이 있어도 새로 고르면 연결이 먼저다", () => {
    createLinksMock({ accountIds: [3], cardIds: [] });
    const candidates = toLinkCandidates(linkCandidatesMock());
    expect(linkCtaAction(candidates, toLinkRequest(candidates, new Set(["5310123412341234"])))).toBe("link");
  });
});
