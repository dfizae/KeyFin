import { classifyTransactionMock, pendingTransactionsMock, subcategoriesMock } from "@/api/mocks/transaction";
import { toClassifyResult, toPendingTransactions, toSubcategories, toTransaction } from "@/features/transaction/model";
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
