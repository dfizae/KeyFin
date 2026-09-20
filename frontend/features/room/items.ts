import { SLOT_TYPES, type SlotType } from "@/features/room/model";
import { ContractMismatchError } from "@/lib/contract";

/**
 * 보유 아바타 아이템과 착장의 서버 계약 (배포 서버 Swagger 2026-09-20 대조, FR-GAM-05).
 *
 * GET /items 는 본인 소유 아이템을 보유 내역 id 오름차순으로 준다(페이지 없음, 없으면 빈 배열).
 * 기본 에셋은 오지 않고, 판매가 끝난 상품이어도 이미 가졌으면 온다.
 * PATCH /items/{userItemId} 는 부위를 서버가 판단해 같은 부위의 기존 아이템을 자동으로 벗기고,
 * 바꾼 뒤의 **전체 착장**을 돌려준다 — 그래서 화면은 응답으로 목록의 착용 여부를 다시 맞춘다.
 */

/** 아바타가 입는 부위 6종(서버 응답 순서와 같다). WALL·FLOOR 는 가구라 옷장에 나오지 않는다 */
export const AVATAR_SLOTS = ["HEAD", "FACE", "UPPER_BODY", "LOWER_BODY", "SOCKS", "FOOTWEAR"] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

export type UserItemDto = {
  userItemId: number;
  itemId: number;
  name: string;
  slotType: string;
  assetKey: string;
  equipped: boolean;
};

export type UserItem = {
  /** 보유 내역 id. 장착·해제 요청에 쓴다(상품 id 가 아니다) */
  userItemId: number;
  itemId: number;
  name: string;
  slot: SlotType;
  assetKey: string;
  equipped: boolean;
};

export type ItemEquipmentRequest = { equipped: boolean };

export type AvatarEquipmentDto = {
  equipped: { userItemId: number; itemId: number; slotType: string; assetKey: string }[];
};

/** 변경 후 전체 착장. 미장착 부위는 빠지고, 모두 벗으면 빈 배열이다 */
export type EquippedAvatarItem = { userItemId: number; itemId: number; slot: SlotType; assetKey: string };

function isRecordId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function toSlotType(raw: string): SlotType {
  return (SLOT_TYPES as readonly string[]).includes(raw) ? (raw as SlotType) : "UNKNOWN";
}

export function toUserItem(dto: UserItemDto): UserItem {
  if (!isRecordId(dto.userItemId)) throw new ContractMismatchError("userItemId");
  if (!isRecordId(dto.itemId)) throw new ContractMismatchError("itemId");
  return {
    userItemId: dto.userItemId,
    itemId: dto.itemId,
    name: dto.name,
    slot: toSlotType(dto.slotType),
    assetKey: dto.assetKey,
    equipped: dto.equipped,
  };
}

export function toUserItems(dtos: UserItemDto[]): UserItem[] {
  return dtos.map(toUserItem);
}

export function toAvatarEquipment(dto: AvatarEquipmentDto): EquippedAvatarItem[] {
  return dto.equipped.map((item) => {
    if (!isRecordId(item.userItemId)) throw new ContractMismatchError("equipped.userItemId");
    if (!isRecordId(item.itemId)) throw new ContractMismatchError("equipped.itemId");
    return { userItemId: item.userItemId, itemId: item.itemId, slot: toSlotType(item.slotType), assetKey: item.assetKey };
  });
}

/** 고른 부위의 아이템만. 서버가 보유 id 오름차순으로 주므로 순서를 바꾸지 않는다 */
export function userItemsInSlot(items: readonly UserItem[], slot: AvatarSlot): UserItem[] {
  return items.filter((item) => item.slot === slot);
}

/**
 * 장착·해제 응답(전체 착장)으로 목록의 착용 여부를 다시 맞춘다.
 * 서버가 같은 부위의 기존 아이템을 자동으로 벗기므로, 바뀐 것만 고치지 않고 착장에 있는지로 전부 다시 정한다.
 */
export function applyAvatarEquipment(items: readonly UserItem[], equipment: readonly EquippedAvatarItem[]): UserItem[] {
  const equipped = new Set(equipment.map((item) => item.userItemId));
  return items.map((item) => (item.equipped === equipped.has(item.userItemId) ? item : { ...item, equipped: equipped.has(item.userItemId) }));
}

/** 그 부위에 지금 입고 있는 아이템. 없으면 기본 에셋 차림이라 null 이다 */
export function equippedItemInSlot(items: readonly UserItem[], slot: AvatarSlot): UserItem | null {
  return items.find((item) => item.slot === slot && item.equipped) ?? null;
}
