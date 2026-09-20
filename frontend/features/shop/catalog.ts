import { CalendarCheck, CalendarRange, Coins, ListChecks, Package, Shirt, ShoppingBag, Sofa, Trophy, type LucideIcon } from "lucide-react-native";

import { roomItem, roomItemIdByAssetKey } from "@/features/room/catalog";
import type { CoinReason, ShopCategory, ShopSlot } from "@/features/shop/model";

/** 코인 사유별 아이콘 (Pencil PAGE-30 코인 이력 f7YQj Icon tile). 사유 코드는 계약이고 아이콘은 클라이언트 상수다 */
const COIN_REASON_ICONS: Record<CoinReason, LucideIcon> = {
  ATTEND: CalendarCheck,
  CONFIRM_ALL: ListChecks,
  WEEKLY: CalendarRange,
  MONTHLY: Trophy,
  PURCHASE: ShoppingBag,
  UNKNOWN: Coins,
};

export function coinReasonIcon(reason: CoinReason): LucideIcon {
  return COIN_REASON_ICONS[reason];
}

/** 상점 슬롯 탭 이름. 슬롯 값은 계약이고 이름은 클라이언트 상수다 (PAGE-29, Pencil 시안 없음) */
const SHOP_SLOT_LABELS: Record<ShopSlot, string> = {
  HEAD: "머리",
  FACE: "얼굴",
  UPPER_BODY: "상의",
  LOWER_BODY: "하의",
  SOCKS: "양말",
  FOOTWEAR: "신발",
  WALL: "벽",
  FLOOR: "바닥",
  UNKNOWN: "기타",
};

export function shopSlotLabel(slot: ShopSlot): string {
  return SHOP_SLOT_LABELS[slot];
}

/** 그림이 없는 상품 자리에 대신 둘 아이콘. 아바타 파츠 에셋은 아직 없어 카테고리로만 가른다 */
const SHOP_CATEGORY_ICONS: Record<ShopCategory, LucideIcon> = {
  AVATAR: Shirt,
  FURNITURE: Sofa,
  UNKNOWN: Package,
};

export function shopCategoryIcon(category: ShopCategory): LucideIcon {
  return SHOP_CATEGORY_ICONS[category];
}

/** 상품 그림. 방 가구·벽 상품은 방 카탈로그의 스프라이트를 그대로 쓰고, 에셋이 아직 없는 아바타 파츠는 null 이다 */
export function shopItemSprite(assetKey: string): number | null {
  const id = roomItemIdByAssetKey(assetKey);
  return id === undefined ? null : roomItem(id).sprite;
}
