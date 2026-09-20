import { ContractMismatchError } from "@/lib/contract";
import { formatKRW } from "@/lib/money";

/**
 * GET /fin-coins?cursor=&size= · GET /fin-coins/balance 계약 (백엔드 develop FinCoinController, 2026-09-17 대조, FR-GAM-08).
 * 이력은 id 내림차순(최신순) 커서 페이지다. delta 는 적립 양수·사용 음수, balanceAfter 는 그 이력 반영 후 잔액(서버 값, 다시 계산하지 않는다).
 * reasonText 는 서버가 사유 코드로 만든 문구라 그대로 보여 준다. grantDate 는 지급 기준일(시각 없음)이다.
 * 잔액은 이력 응답에 없어 GET /fin-coins/balance 로 따로 받는다(이력이 없으면 0).
 */
export const COIN_REASONS = ["ATTEND", "CONFIRM_ALL", "WEEKLY", "MONTHLY", "PURCHASE"] as const;
export type CoinReason = (typeof COIN_REASONS)[number] | "UNKNOWN";

export type CoinHistoryItemDto = {
  id: number;
  delta: number;
  balanceAfter: number;
  reasonCode: string;
  reasonText: string;
  /** "2026-09-10" */
  grantDate: string;
};

export type CoinHistoryDto = { items: CoinHistoryItemDto[]; nextCursor: number | null };

export type CoinBalanceDto = { balance: number };

export type CoinHistoryItem = {
  id: number;
  delta: number;
  balanceAfter: number;
  reason: CoinReason;
  reasonText: string;
  grantDate: string;
};

export type CoinHistoryPage = { items: CoinHistoryItem[]; nextCursor: number | null };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function toCoinReason(raw: string): CoinReason {
  return (COIN_REASONS as readonly string[]).includes(raw) ? (raw as CoinReason) : "UNKNOWN";
}

function isCoinCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function toCoinHistoryItem(dto: CoinHistoryItemDto): CoinHistoryItem {
  if (!Number.isSafeInteger(dto.id) || dto.id <= 0) throw new ContractMismatchError("items.id");
  if (!Number.isSafeInteger(dto.delta)) throw new ContractMismatchError("items.delta");
  if (!isCoinCount(dto.balanceAfter)) throw new ContractMismatchError("items.balanceAfter");
  if (!DATE_KEY.test(dto.grantDate)) throw new ContractMismatchError("items.grantDate");
  return {
    id: dto.id,
    delta: dto.delta,
    balanceAfter: dto.balanceAfter,
    reason: toCoinReason(dto.reasonCode),
    reasonText: dto.reasonText,
    grantDate: dto.grantDate,
  };
}

export function toCoinHistoryPage(dto: CoinHistoryDto): CoinHistoryPage {
  return { items: dto.items.map(toCoinHistoryItem), nextCursor: dto.nextCursor };
}

export function toCoinBalance(dto: CoinBalanceDto): number {
  if (!isCoinCount(dto.balance)) throw new ContractMismatchError("balance");
  return dto.balance;
}

/** 코인 수 "1,260". 홈 코인 배지와 같은 자릿수 구분이다 */
export function coinCountLabel(count: number): string {
  return formatKRW(String(count), { unit: false });
}

/** 증감 "+10" · "-300" */
export function coinDeltaLabel(delta: number): string {
  return formatKRW(String(delta), { unit: false, sign: "always" });
}

/** 읽어 주는 문구: "10코인 적립" · "300코인 사용" */
export function coinDeltaSpoken(delta: number): string {
  const count = coinCountLabel(Math.abs(delta));
  return delta < 0 ? `${count}코인 사용` : `${count}코인 적립`;
}

export type CoinDateGroup = { dateKey: string; items: CoinHistoryItem[] };

/** 지급 기준일로 묶는다. 서버가 최신순으로 주므로 순서를 바꾸지 않고 이어진 같은 날짜만 모은다 */
export function groupCoinHistoryByDate(items: CoinHistoryItem[]): CoinDateGroup[] {
  const groups: CoinDateGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.dateKey === item.grantDate) last.items.push(item);
    else groups.push({ dateKey: item.grantDate, items: [item] });
  }
  return groups;
}

/* ───────────── 상점: GET /shop · POST /shop/purchase (배포 서버 Swagger 2026-09-20 대조, FR-GAM-05) ───────────── */

/**
 * 상품은 상품 id 오름차순으로 한 번에 온다(페이지 없음, 없으면 빈 배열). 보유한 상품도 빠지지 않고 owned 로 표시된다.
 * price 는 코인 개수이고 0 이면 무료다. themeCode 는 상시 상품이면 null 이다.
 * 모르는 카테고리·슬롯은 UNKNOWN 으로 흡수한다 (규칙 90) — 새 슬롯이 생겨도 상품이 사라지지 않게 '기타' 탭으로 보여 준다.
 */
export const SHOP_CATEGORIES = ["AVATAR", "FURNITURE"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number] | "UNKNOWN";

/** 캐릭터 6부위 + 방 2자리. 상점 탭 순서이기도 하다 */
export const SHOP_SLOTS = ["HEAD", "FACE", "UPPER_BODY", "LOWER_BODY", "SOCKS", "FOOTWEAR", "WALL", "FLOOR"] as const;
export type ShopSlot = (typeof SHOP_SLOTS)[number] | "UNKNOWN";

export type ShopItemDto = {
  itemId: number;
  itemCategory: string;
  slotType: string;
  name: string;
  /** 코인 가격. 0 이면 무료 */
  price: number;
  assetKey: string;
  /** 상시 상품이면 null */
  themeCode: string | null;
  owned: boolean;
};

export type ShopItem = {
  itemId: number;
  category: ShopCategory;
  slot: ShopSlot;
  name: string;
  price: number;
  assetKey: string;
  themeCode: string | null;
  owned: boolean;
};

export type ShopPurchaseRequest = { itemId: number };

export type ShopPurchaseDto = {
  itemId: number;
  itemCategory: string;
  /** 아바타 보유 내역 id. 가구를 샀으면 null */
  userItemId: number | null;
  /** 가구 보유 내역 id. 아바타를 샀으면 null */
  userFurnitureId: number | null;
  price: number;
  /** 구매 직후 코인 잔액(서버 값, 다시 계산하지 않는다) */
  balance: number;
};

export type ShopPurchase = {
  itemId: number;
  category: ShopCategory;
  userItemId: number | null;
  userFurnitureId: number | null;
  price: number;
  balance: number;
};

function toShopCategory(raw: string): ShopCategory {
  return (SHOP_CATEGORIES as readonly string[]).includes(raw) ? (raw as ShopCategory) : "UNKNOWN";
}

function toShopSlot(raw: string): ShopSlot {
  return (SHOP_SLOTS as readonly string[]).includes(raw) ? (raw as ShopSlot) : "UNKNOWN";
}

function isItemId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function toShopItem(dto: ShopItemDto): ShopItem {
  if (!isItemId(dto.itemId)) throw new ContractMismatchError("itemId");
  if (!isCoinCount(dto.price)) throw new ContractMismatchError("price");
  return {
    itemId: dto.itemId,
    category: toShopCategory(dto.itemCategory),
    slot: toShopSlot(dto.slotType),
    name: dto.name,
    price: dto.price,
    assetKey: dto.assetKey,
    themeCode: dto.themeCode ?? null,
    owned: dto.owned,
  };
}

export function toShopItems(dtos: ShopItemDto[]): ShopItem[] {
  return dtos.map(toShopItem);
}

export function toShopPurchase(dto: ShopPurchaseDto): ShopPurchase {
  if (!isItemId(dto.itemId)) throw new ContractMismatchError("itemId");
  if (!isCoinCount(dto.price)) throw new ContractMismatchError("price");
  if (!isCoinCount(dto.balance)) throw new ContractMismatchError("balance");
  return {
    itemId: dto.itemId,
    category: toShopCategory(dto.itemCategory),
    userItemId: isItemId(dto.userItemId) ? dto.userItemId : null,
    userFurnitureId: isItemId(dto.userFurnitureId) ? dto.userFurnitureId : null,
    price: dto.price,
    balance: dto.balance,
  };
}

/** 상점 탭. 비어 있는 슬롯도 자리를 지켜 탭이 들쭉날쭉하지 않게 두고, 모르는 슬롯 상품이 있을 때만 '기타'를 붙인다 */
export function shopSlotTabs(items: readonly ShopItem[]): ShopSlot[] {
  const tabs: ShopSlot[] = [...SHOP_SLOTS];
  if (items.some((item) => item.slot === "UNKNOWN")) tabs.push("UNKNOWN");
  return tabs;
}

/** 고른 탭의 상품만. 서버가 id 오름차순으로 주므로 순서를 바꾸지 않는다 */
export function shopItemsInSlot(items: readonly ShopItem[], slot: ShopSlot): ShopItem[] {
  return items.filter((item) => item.slot === slot);
}

/** 살 수 있는지. 이미 가졌거나 코인이 모자라면 못 산다(무료 상품은 잔액과 무관하게 살 수 있다) */
export function canBuyShopItem(item: ShopItem, balance: number | undefined): boolean {
  if (item.owned) return false;
  return balance !== undefined && balance >= item.price;
}

/** 가격 문구 "100" · 무료는 "무료" */
export function shopPriceLabel(price: number): string {
  return price === 0 ? "무료" : coinCountLabel(price);
}
