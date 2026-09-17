import { coinBalanceMock, coinHistoryMock } from "@/api/mocks/shop";
import {
  coinCountLabel,
  coinDeltaLabel,
  coinDeltaSpoken,
  groupCoinHistoryByDate,
  toCoinBalance,
  toCoinHistoryItem,
  toCoinHistoryPage,
  type CoinHistoryItemDto,
} from "@/features/shop/model";
import { ContractMismatchError } from "@/lib/contract";

const TODAY = "2026-09-17";

/** 계약 예시(Swagger FinCoinResponse)의 아이템 구매 */
function dto(overrides: Partial<CoinHistoryItemDto> = {}): CoinHistoryItemDto {
  return {
    id: 42,
    delta: -100,
    balanceAfter: 1250,
    reasonCode: "PURCHASE",
    reasonText: "아이템 구매",
    grantDate: "2026-09-10",
    ...overrides,
  };
}

describe("toCoinHistoryPage", () => {
  it("계약 예시를 화면 모델로 옮기고, 사유 문구는 서버 값 그대로 둔다", () => {
    const page = toCoinHistoryPage({ items: [dto()], nextCursor: null });

    expect(page).toEqual({
      items: [{ id: 42, delta: -100, balanceAfter: 1250, reason: "PURCHASE", reasonText: "아이템 구매", grantDate: "2026-09-10" }],
      nextCursor: null,
    });
  });

  it("모르는 사유 코드는 UNKNOWN 으로 흡수한다", () => {
    expect(toCoinHistoryItem(dto({ reasonCode: "EVENT", reasonText: "이벤트 보상", delta: 50 })).reason).toBe("UNKNOWN");
  });

  it("id·증감·잔액·날짜 형식이 틀리면 계약 불일치다", () => {
    expect(() => toCoinHistoryItem(dto({ id: 0 }))).toThrow(ContractMismatchError);
    expect(() => toCoinHistoryItem(dto({ delta: 1.5 }))).toThrow(ContractMismatchError);
    expect(() => toCoinHistoryItem(dto({ balanceAfter: -1 }))).toThrow(ContractMismatchError);
    expect(() => toCoinHistoryItem(dto({ grantDate: "2026-09-10T00:00:00" }))).toThrow(ContractMismatchError);
    expect(() => toCoinBalance({ balance: -5 })).toThrow(ContractMismatchError);
    expect(toCoinBalance({ balance: 0 })).toBe(0);
  });
});

describe("코인 표기", () => {
  it("수는 자릿수를 나누고, 증감은 부호를 붙이며, 읽기 문구는 적립·사용으로 말한다", () => {
    expect(coinCountLabel(1260)).toBe("1,260");
    expect(coinDeltaLabel(10)).toBe("+10");
    expect(coinDeltaLabel(-1300)).toBe("-1,300");
    expect(coinDeltaSpoken(200)).toBe("200코인 적립");
    expect(coinDeltaSpoken(-300)).toBe("300코인 사용");
  });
});

describe("groupCoinHistoryByDate", () => {
  it("서버 순서(최신순)를 유지하며 이어진 같은 지급일만 묶는다", () => {
    const items = [
      dto({ id: 5, grantDate: "2026-09-17" }),
      dto({ id: 4, grantDate: "2026-09-16" }),
      dto({ id: 3, grantDate: "2026-09-16" }),
    ].map(toCoinHistoryItem);

    expect(groupCoinHistoryByDate(items).map((group) => [group.dateKey, group.items.map((item) => item.id)])).toEqual([
      ["2026-09-17", [5]],
      ["2026-09-16", [4, 3]],
    ]);
  });
});

describe("코인 목 — 서버처럼 쪽을 나누고 잔액과 맞는다", () => {
  it("최신순 20건씩이고 마지막 쪽은 nextCursor 가 null 이다", () => {
    const first = coinHistoryMock({ cursor: null, size: 20 }, TODAY);
    const second = coinHistoryMock({ cursor: first.nextCursor, size: 20 }, TODAY);

    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    expect(second.nextCursor).toBeNull();
    expect(Math.min(...first.items.map((item) => item.id))).toBeGreaterThan(Math.max(...second.items.map((item) => item.id)));
  });

  it("가장 최근 이력의 잔액이 잔액 조회와 같고, 이력마다 이전 잔액 + 증감이 반영 후 잔액이다", () => {
    const all = coinHistoryMock({ cursor: null, size: 100 }, TODAY).items;

    expect(all[0]).toMatchObject({ grantDate: TODAY, reasonCode: "ATTEND", delta: 10 });
    expect(all[0].balanceAfter).toBe(coinBalanceMock().balance);
    for (let index = 0; index < all.length - 1; index += 1) {
      expect(all[index].balanceAfter).toBe(all[index + 1].balanceAfter + all[index].delta);
    }
    expect(all.every((item) => item.balanceAfter >= 0)).toBe(true);
  });
});
