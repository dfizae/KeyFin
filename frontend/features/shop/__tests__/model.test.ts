import { ApiError } from "@/api/error";
import { coinBalanceMock, coinHistoryMock, purchaseShopItemMock, resetShopMocks, shopItemsMock } from "@/api/mocks/shop";
import {
  coinCountLabel,
  coinDeltaLabel,
  coinDeltaSpoken,
  groupCoinHistoryByDate,
  canBuyShopItem,
  shopItemsInSlot,
  shopPriceLabel,
  shopSlotTabs,
  toCoinBalance,
  toCoinHistoryItem,
  toCoinHistoryPage,
  toShopItem,
  toShopItems,
  toShopPurchase,
  type CoinHistoryItemDto,
  type ShopItemDto,
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

/** 계약 예시(Swagger ShopItemResponse)의 파란 모자 */
function shopDto(overrides: Partial<ShopItemDto> = {}): ShopItemDto {
  return {
    itemId: 123,
    itemCategory: "AVATAR",
    slotType: "HEAD",
    name: "파란 모자",
    price: 100,
    assetKey: "hat_blue",
    themeCode: null,
    owned: false,
    ...overrides,
  };
}

describe("상점 상품 (GET /shop)", () => {
  it("계약 예시를 화면 모델로 바꾸고, 모르는 카테고리·슬롯은 UNKNOWN 으로 흡수한다", () => {
    expect(toShopItem(shopDto())).toEqual({
      itemId: 123,
      category: "AVATAR",
      slot: "HEAD",
      name: "파란 모자",
      price: 100,
      assetKey: "hat_blue",
      themeCode: null,
      owned: false,
    });

    const unknown = toShopItem(shopDto({ itemCategory: "PET", slotType: "TAIL" }));
    expect(unknown.category).toBe("UNKNOWN");
    expect(unknown.slot).toBe("UNKNOWN");
  });

  it("상품 id 와 가격이 계약과 다르면 계약 불일치로 막는다", () => {
    expect(() => toShopItem(shopDto({ itemId: 0 }))).toThrow(ContractMismatchError);
    expect(() => toShopItem(shopDto({ price: -1 }))).toThrow(ContractMismatchError);
    expect(() => toShopItem(shopDto({ price: 1.5 }))).toThrow(ContractMismatchError);
    expect(toShopItem(shopDto({ price: 0 })).price).toBe(0);
  });

  it("탭은 슬롯 8종을 그대로 두고, 모르는 슬롯 상품이 있을 때만 기타가 붙는다", () => {
    const known = toShopItems([shopDto(), shopDto({ itemId: 124, slotType: "FLOOR", itemCategory: "FURNITURE" })]);
    expect(shopSlotTabs(known)).toEqual(["HEAD", "FACE", "UPPER_BODY", "LOWER_BODY", "SOCKS", "FOOTWEAR", "WALL", "FLOOR"]);
    expect(shopSlotTabs([...known, toShopItem(shopDto({ itemId: 125, slotType: "TAIL" }))])).toContain("UNKNOWN");
  });

  it("탭의 상품만 서버 순서 그대로 고른다", () => {
    const items = toShopItems([shopDto(), shopDto({ itemId: 124 }), shopDto({ itemId: 125, slotType: "FACE" })]);
    expect(shopItemsInSlot(items, "HEAD").map((item) => item.itemId)).toEqual([123, 124]);
    expect(shopItemsInSlot(items, "WALL")).toEqual([]);
  });

  it("보유했거나 코인이 모자라면 못 사고, 무료 상품은 잔액과 무관하게 산다", () => {
    const item = toShopItem(shopDto());
    expect(canBuyShopItem(item, 100)).toBe(true);
    expect(canBuyShopItem(item, 99)).toBe(false);
    expect(canBuyShopItem(item, undefined)).toBe(false);
    expect(canBuyShopItem(toShopItem(shopDto({ owned: true })), 1000)).toBe(false);
    expect(canBuyShopItem(toShopItem(shopDto({ price: 0 })), 0)).toBe(true);
  });

  it("가격 문구는 자릿수를 나누고 0 은 무료다", () => {
    expect(shopPriceLabel(0)).toBe("무료");
    expect(shopPriceLabel(1200)).toBe("1,200");
  });
});

describe("상점 구매 (POST /shop/purchase)", () => {
  it("아바타는 userItemId, 가구는 userFurnitureId 만 온다", () => {
    const avatar = toShopPurchase({ itemId: 123, itemCategory: "AVATAR", userItemId: 501, userFurnitureId: null, price: 100, balance: 900 });
    expect(avatar).toMatchObject({ category: "AVATAR", userItemId: 501, userFurnitureId: null, balance: 900 });

    const furniture = toShopPurchase({ itemId: 124, itemCategory: "FURNITURE", userItemId: null, userFurnitureId: 601, price: 500, balance: 400 });
    expect(furniture).toMatchObject({ category: "FURNITURE", userItemId: null, userFurnitureId: 601 });
  });

  it("잔액이 계약과 다르면 계약 불일치로 막는다", () => {
    const dtoOf = (balance: number) => ({ itemId: 123, itemCategory: "AVATAR", userItemId: 501, userFurnitureId: null, price: 100, balance });
    expect(() => toShopPurchase(dtoOf(-1))).toThrow(ContractMismatchError);
    expect(toShopPurchase(dtoOf(0)).balance).toBe(0);
  });

  it("목은 서버처럼 한 번만 팔고, 같은 상품을 다시 사면 409 SHOP_002 다", () => {
    resetShopMocks();
    const item = shopItemsMock().find((candidate) => !candidate.owned && candidate.price > 0);
    if (item === undefined) throw new Error("살 수 있는 목 상품이 없다");

    const before = coinBalanceMock().balance;
    const result = purchaseShopItemMock({ itemId: item.itemId });
    expect(result.balance).toBe(before - item.price);
    expect(coinBalanceMock().balance).toBe(before - item.price);
    expect(shopItemsMock().find((candidate) => candidate.itemId === item.itemId)?.owned).toBe(true);

    const codeOf = (run: () => void) => {
      try {
        run();
        return null;
      } catch (error) {
        return error instanceof ApiError ? error.code : "NOT_API_ERROR";
      }
    };
    expect(codeOf(() => purchaseShopItemMock({ itemId: item.itemId }))).toBe("SHOP_002");
    expect(codeOf(() => purchaseShopItemMock({ itemId: 9999 }))).toBe("COMMON_001");
    resetShopMocks();
  });
});
