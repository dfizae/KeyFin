import { ApiError } from "@/api/error";
import { resetItemMocks, updateItemEquipmentMock, userItemListMock } from "@/api/mocks/item";
import {
  applyAvatarEquipment,
  equippedItemInSlot,
  toAvatarEquipment,
  toUserItem,
  toUserItems,
  userItemsInSlot,
  type UserItemDto,
} from "@/features/room/items";
import { ContractMismatchError } from "@/lib/contract";

/** 계약 예시(Swagger UserItemResponse)의 파란 셔츠 */
function dto(overrides: Partial<UserItemDto> = {}): UserItemDto {
  return {
    userItemId: 101,
    itemId: 3,
    name: "파란 셔츠",
    slotType: "UPPER_BODY",
    assetKey: "shirt_blue",
    equipped: true,
    ...overrides,
  };
}

describe("보유 아이템 (GET /items)", () => {
  it("계약 예시를 화면 모델로 바꾸고, 모르는 부위는 UNKNOWN 으로 흡수한다", () => {
    expect(toUserItem(dto())).toEqual({
      userItemId: 101,
      itemId: 3,
      name: "파란 셔츠",
      slot: "UPPER_BODY",
      assetKey: "shirt_blue",
      equipped: true,
    });
    expect(toUserItem(dto({ slotType: "TAIL" })).slot).toBe("UNKNOWN");
  });

  it("보유 내역 id 와 상품 id 가 계약과 다르면 계약 불일치로 막는다", () => {
    expect(() => toUserItem(dto({ userItemId: 0 }))).toThrow(ContractMismatchError);
    expect(() => toUserItem(dto({ itemId: -3 }))).toThrow(ContractMismatchError);
  });

  it("부위 탭은 그 부위의 아이템만 서버 순서 그대로 고르고, 입은 것을 따로 꺼낸다", () => {
    const items = toUserItems([
      dto({ userItemId: 101, equipped: false }),
      dto({ userItemId: 102, name: "니트", equipped: true }),
      dto({ userItemId: 103, slotType: "HEAD", name: "모자", equipped: false }),
    ]);

    expect(userItemsInSlot(items, "UPPER_BODY").map((item) => item.userItemId)).toEqual([101, 102]);
    expect(equippedItemInSlot(items, "UPPER_BODY")?.name).toBe("니트");
    expect(equippedItemInSlot(items, "HEAD")).toBeNull();
  });
});

describe("장착·해제 (PATCH /items/{userItemId})", () => {
  it("전체 착장을 화면 모델로 바꾸고, 모두 벗으면 빈 배열이다", () => {
    const equipment = toAvatarEquipment({
      equipped: [{ userItemId: 101, itemId: 3, slotType: "UPPER_BODY", assetKey: "shirt_blue" }],
    });
    expect(equipment).toEqual([{ userItemId: 101, itemId: 3, slot: "UPPER_BODY", assetKey: "shirt_blue" }]);
    expect(toAvatarEquipment({ equipped: [] })).toEqual([]);
  });

  it("응답의 전체 착장으로 목록을 맞춰, 서버가 자동으로 벗긴 아이템도 벗은 것으로 바뀐다", () => {
    const items = toUserItems([dto({ userItemId: 101, equipped: true }), dto({ userItemId: 102, name: "니트", equipped: false })]);
    const afterSwap = applyAvatarEquipment(items, [{ userItemId: 102, itemId: 5, slot: "UPPER_BODY", assetKey: "knit" }]);

    expect(afterSwap.map((item) => item.equipped)).toEqual([false, true]);
    expect(applyAvatarEquipment(afterSwap, []).every((item) => !item.equipped)).toBe(true);
  });

  it("목은 서버처럼 같은 부위를 자동으로 벗기고, 없는 보유 내역은 404 ITEM_001 이다", () => {
    resetItemMocks();
    const before = userItemListMock("UPPER_BODY");
    const wearing = before.find((item) => item.equipped);
    const spare = before.find((item) => !item.equipped);
    if (wearing === undefined || spare === undefined) throw new Error("상의 목 데이터가 모자라다");

    const equipment = updateItemEquipmentMock(spare.userItemId, { equipped: true });
    const ids = equipment.equipped.map((item) => item.userItemId);
    expect(ids).toContain(spare.userItemId);
    expect(ids).not.toContain(wearing.userItemId);

    // 같은 요청을 다시 보내도 성공한다(멱등)
    expect(updateItemEquipmentMock(spare.userItemId, { equipped: true }).equipped.map((item) => item.userItemId)).toEqual(ids);
    expect(updateItemEquipmentMock(spare.userItemId, { equipped: false }).equipped.map((item) => item.userItemId)).not.toContain(
      spare.userItemId
    );

    try {
      updateItemEquipmentMock(9999, { equipped: true });
      throw new Error("404 가 나지 않았다");
    } catch (error) {
      expect(error instanceof ApiError ? error.code : null).toBe("ITEM_001");
    }
    resetItemMocks();
  });
});
