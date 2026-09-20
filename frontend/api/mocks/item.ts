import { ApiError } from "@/api/error";
import type { AvatarEquipmentDto, ItemEquipmentRequest, UserItemDto } from "@/features/room/items";

/**
 * GET /items · PATCH /items/{userItemId} 목 (배포 서버 Swagger 2026-09-20).
 * 서버처럼 상태를 들고 있어서 옷장에서 갈아입고 나오면 그대로다(다른 도메인 목과 같은 방식).
 * 아바타 파츠 에셋이 아직 없어 assetKey 는 이름표일 뿐이고 화면에는 그림 대신 아이콘이 나온다.
 * 보유 내역 id 는 목 안에서만 쓰는 번호이며 501 부터 매긴다. 상점 목(api/mocks/shop.ts)의 상품 id 와 맞춰 둔다.
 */
const SEED: readonly UserItemDto[] = [
  { userItemId: 501, itemId: 3, name: "동그란 안경", slotType: "FACE", assetKey: "glasses_round", equipped: true },
  { userItemId: 502, itemId: 4, name: "기본 티셔츠", slotType: "UPPER_BODY", assetKey: "tee_basic", equipped: true },
  { userItemId: 503, itemId: 5, name: "니트 가디건", slotType: "UPPER_BODY", assetKey: "cardigan_knit", equipped: false },
  { userItemId: 504, itemId: 6, name: "청바지", slotType: "LOWER_BODY", assetKey: "jeans_blue", equipped: false },
  { userItemId: 505, itemId: 7, name: "줄무늬 양말", slotType: "SOCKS", assetKey: "socks_stripe", equipped: false },
];

let items: UserItemDto[] | null = null;

function ensure(): UserItemDto[] {
  if (items === null) items = SEED.map((item) => ({ ...item }));
  return items;
}

/** 서버는 보유 id 오름차순으로 주고, slotType 을 주면 그 부위만 준다 */
export function userItemListMock(slotType?: string): UserItemDto[] {
  return ensure()
    .filter((item) => slotType === undefined || item.slotType === slotType)
    .map((item) => ({ ...item }));
}

/**
 * 서버처럼 부위를 보고 같은 부위의 기존 아이템을 벗긴 뒤, 바꾼 뒤의 전체 착장을 돌려준다.
 * 같은 상태를 다시 보내도 성공한다(멱등). 없는 보유 내역은 404 ITEM_001 이다.
 */
export function updateItemEquipmentMock(userItemId: number, request: ItemEquipmentRequest): AvatarEquipmentDto {
  const all = ensure();
  const target = all.find((item) => item.userItemId === userItemId);
  if (target === undefined) throw new ApiError(404, "ITEM_001", "보유한 아이템이 없습니다.");

  if (request.equipped) {
    for (const item of all) {
      if (item.slotType === target.slotType) item.equipped = item.userItemId === userItemId;
    }
  } else {
    target.equipped = false;
  }

  return {
    equipped: all
      .filter((item) => item.equipped)
      .map((item) => ({ userItemId: item.userItemId, itemId: item.itemId, slotType: item.slotType, assetKey: item.assetKey })),
  };
}

export function resetItemMocks(): void {
  items = null;
}
