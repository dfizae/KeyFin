import { classifyTransactionMock, pendingTransactionsMock, subcategoriesMock, transactionListMock } from "@/api/mocks/transaction";
import {
  isIncoming,
  monthFilterLabel,
  parseTransactionFilter,
  shiftMonthKey,
  toClassifyResult,
  toPendingTransactions,
  toSubcategories,
  toTransaction,
  toTransactionPage,
  transactionBadge,
  transactionCategoryLabel,
} from "@/features/transaction/model";
import { ContractMismatchError } from "@/lib/contract";

describe("toTransaction", () => {
  const dto = pendingTransactionsMock().items[0];

  it("금액을 KRW 로, 거래일에서 월 키를 만들고 열거형을 유니온으로 옮긴다", () => {
    const tx = toTransaction(dto);
    expect(tx.amount).toBe("4500");
    expect(tx.monthKey).toBe("202609");
    expect(tx.txType).toBe("CARD");
    expect(tx.confirmStatus).toBe("PENDING");
    expect(tx.excludeTag).toBe("NONE");
    expect(tx.status).toBe("NORMAL");
    expect(tx.memo).toBeNull();
  });

  it("모르는 열거형 값은 UNKNOWN 으로 흡수하고 거래일 형식이 틀리면 계약 불일치다", () => {
    expect(toTransaction({ ...dto, txType: "COUPON", excludeTag: "GIFT" })).toMatchObject({ txType: "UNKNOWN", excludeTag: "UNKNOWN" });
    expect(() => toTransaction({ ...dto, txDate: "20260908" })).toThrow(ContractMismatchError);
    expect(() => toTransaction({ ...dto, amount: 4500.5 })).toThrow(ContractMismatchError);
  });
});

describe("pending · subcategories · classify", () => {
  it("미확정 목록과 세분류 22종을 변환한다", () => {
    expect(toPendingTransactions(pendingTransactionsMock()).items.map((item) => item.id)).toEqual([501, 502]);
    expect(toSubcategories(subcategoriesMock)).toHaveLength(22);
    expect(toSubcategories(subcategoriesMock)[1]).toEqual({ id: 102, name: "카페", envelopeId: 1, envelopeName: "외식" });
  });

  it("확정 응답의 봉투 잔액을 KRW 로 바꾼다", () => {
    const result = toClassifyResult({ confirmStatus: "CONFIRMED", envelopeBalance: { envelopeId: 1, remaining: 132000 } });
    expect(result).toEqual({ confirmStatus: "CONFIRMED", envelopeId: 1, remaining: "132000" });
    expect(() => toClassifyResult({ confirmStatus: "CONFIRMED", envelopeBalance: { envelopeId: 1, remaining: 1.5 } })).toThrow(ContractMismatchError);
  });

  it("목 확정은 미확정 목록에서 그 거래를 뺀다", () => {
    classifyTransactionMock(502, { excludeTag: "DUTCH" });
    expect(pendingTransactionsMock().items.map((item) => item.id)).toEqual([501]);
  });
});

describe("거래 목록 표시 (isIncoming · transactionCategoryLabel · transactionBadge)", () => {
  const base = toTransaction(pendingTransactionsMock().items[0]);

  it("입금만 들어온 돈이고 분류 자리에 '입금' 이라고 쓴다", () => {
    expect(isIncoming(base)).toBe(false);
    expect(transactionCategoryLabel(base)).toBe("카페");
    const deposit = { ...base, txType: "DEPOSIT" as const };
    expect(isIncoming(deposit)).toBe(true);
    expect(transactionCategoryLabel(deposit)).toBe("입금");
  });

  it("취소가 제외 태그보다 먼저이고, 태그가 없으면 뱃지도 없다", () => {
    expect(transactionBadge(base)).toBeNull();
    expect(transactionBadge({ ...base, excludeTag: "DUTCH" })).toBe("더치페이");
    expect(transactionBadge({ ...base, status: "CANCELED", excludeTag: "DUTCH" })).toBe("취소");
  });
});

describe("shiftMonthKey · monthFilterLabel", () => {
  it("해를 넘겨 달을 옮기고 라벨을 만든다", () => {
    expect(shiftMonthKey("202601", -1)).toBe("202512");
    expect(shiftMonthKey("202612", 1)).toBe("202701");
    expect(monthFilterLabel("202609")).toBe("2026년 9월");
  });
});

describe("parseTransactionFilter", () => {
  const THIS_MONTH = "202609";

  it("달이 없거나 틀리거나 미래면 이번 달로 돌린다", () => {
    expect(parseTransactionFilter({}, THIS_MONTH)).toEqual({ month: THIS_MONTH });
    expect(parseTransactionFilter({ month: "2026-08" }, THIS_MONTH)).toEqual({ month: THIS_MONTH });
    expect(parseTransactionFilter({ month: "202610" }, THIS_MONTH)).toEqual({ month: THIS_MONTH });
    expect(parseTransactionFilter({ month: "202608" }, THIS_MONTH)).toEqual({ month: "202608" });
  });

  it("id 는 양의 정수만 받고, 계좌와 카드가 둘 다 오면 계좌만 쓴다", () => {
    expect(parseTransactionFilter({ envelopeId: "3", accountId: "1", cardId: "2" }, THIS_MONTH)).toEqual({
      month: THIS_MONTH,
      envelopeId: 3,
      accountId: 1,
    });
    expect(parseTransactionFilter({ envelopeId: "0", cardId: ["2", "9"] }, THIS_MONTH)).toEqual({ month: THIS_MONTH, cardId: 2 });
  });
});

describe("transactionListMock · toTransactionPage", () => {
  const TODAY = "2026-09-20";

  it("20건씩 끊고 마지막 id 를 커서로 이어 받으면 겹치지 않는다", () => {
    const first = toTransactionPage(transactionListMock({ month: "202609" }, TODAY));
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBe(first.items[19].id);
    const second = toTransactionPage(transactionListMock({ month: "202609", cursor: first.nextCursor ?? undefined }, TODAY));
    expect(second.items.some((tx) => first.items.some((seen) => seen.id === tx.id))).toBe(false);
  });

  it("마지막 쪽은 nextCursor 가 null 이고 미래 달은 비어 있다", () => {
    const all = transactionListMock({ month: "202609", size: 100 }, TODAY);
    expect(all.nextCursor).toBeNull();
    expect(transactionListMock({ month: "202610" }, TODAY).items).toEqual([]);
  });

  it("봉투·카드 필터에 맞는 거래만 준다", () => {
    const envelope = transactionListMock({ month: "202609", envelopeId: 2, size: 100 }, TODAY);
    expect(envelope.items.every((tx) => tx.envelopeId === 2)).toBe(true);
    const account = transactionListMock({ month: "202609", accountId: 1, size: 100 }, TODAY);
    expect(account.items.some((tx) => tx.txType === "DEPOSIT")).toBe(true);
    expect(account.items.every((tx) => tx.txType !== "CARD")).toBe(true);
  });
});
