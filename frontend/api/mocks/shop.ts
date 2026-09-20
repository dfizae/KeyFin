import { ApiError } from "@/api/error";
import type { CoinBalanceDto, CoinHistoryDto, CoinHistoryItemDto, ShopItemDto, ShopPurchaseDto, ShopPurchaseRequest } from "@/features/shop/model";
import { currentDateKey, parseKSTDateKey, toKSTDateKey } from "@/lib/date";

/**
 * GET /fin-coins · GET /fin-coins/balance 목 (백엔드 FinCoinServiceImpl, 2026-09-17).
 * 잔액은 방 목(api/mocks/room.ts)의 출석 뒤 잔액 1,260 과 같게 맞춘다 — 홈 배지와 코인 화면 숫자가 어긋나지 않게.
 * 지난 20일 치를 서버 규칙대로 쌓는다: 출석 +10(며칠 빠짐), 거래 전건 확인 +30, 월요일 주간 +200, 닷새 전 아이템 구매 -300.
 * 한 쪽(20건)을 넘겨 스크롤 끝에서 다음 쪽을 부르는지 볼 수 있다. reasonText 는 서버 FinCoinReason 문구와 같다.
 */
const BALANCE = 1260;
const HISTORY_DAYS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONDAY = 1;

const REASON_TEXT: Record<string, string> = {
  ATTEND: "출석 보상",
  CONFIRM_ALL: "거래 내역 전체 확인 보상",
  WEEKLY: "주간 보상",
  MONTHLY: "월간 보상",
  PURCHASE: "아이템 구매",
};

type Grant = { daysAgo: number; reasonCode: string; delta: number };

/** 오래된 순. 같은 날은 출석 → 전건 확인 → 주간 → 구매 순으로 쌓인다 */
function grants(todayKey: string): Grant[] {
  const today = parseKSTDateKey(todayKey).getTime();
  const list: Grant[] = [];
  for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo -= 1) {
    const weekday = new Date(`${toKSTDateKey(new Date(today - daysAgo * DAY_MS))}T00:00:00Z`).getUTCDay();
    if (daysAgo % 4 !== 2) list.push({ daysAgo, reasonCode: "ATTEND", delta: 10 });
    if (daysAgo % 3 === 1) list.push({ daysAgo, reasonCode: "CONFIRM_ALL", delta: 30 });
    if (weekday === MONDAY) list.push({ daysAgo, reasonCode: "WEEKLY", delta: 200 });
    if (daysAgo === 5) list.push({ daysAgo, reasonCode: "PURCHASE", delta: -300 });
  }
  return list;
}

function build(todayKey: string): CoinHistoryItemDto[] {
  const today = parseKSTDateKey(todayKey).getTime();
  const list = grants(todayKey);
  let balance = BALANCE - list.reduce((sum, grant) => sum + grant.delta, 0);
  return list.map((grant, index) => {
    balance += grant.delta;
    return {
      id: index + 1,
      delta: grant.delta,
      balanceAfter: balance,
      reasonCode: grant.reasonCode,
      reasonText: REASON_TEXT[grant.reasonCode],
      grantDate: toKSTDateKey(new Date(today - grant.daysAgo * DAY_MS)),
    };
  });
}

/** 서버처럼 id 내림차순, cursor 보다 작은 id 만, 마지막 쪽이면 nextCursor null */
export function coinHistoryMock(page: { cursor: number | null; size: number }, todayKey: string = currentDateKey()): CoinHistoryDto {
  const sorted = build(todayKey)
    .sort((a, b) => b.id - a.id)
    .filter((item) => page.cursor === null || item.id < page.cursor);
  const items = sorted.slice(0, page.size);
  return { items, nextCursor: sorted.length > page.size ? items[items.length - 1].id : null };
}

export function coinBalanceMock(): CoinBalanceDto {
  return { balance: BALANCE - spent };
}

/**
 * GET /shop · POST /shop/purchase 목 (배포 서버 Swagger 2026-09-20).
 * 가구는 방 카탈로그에 있는 assetKey 를 써서 화면에 그림이 나오고, 아바타는 에셋이 아직 없어 이름만 보인다.
 * 구매는 서버처럼 한 번만 되고(두 번째는 409 SHOP_002), 코인이 모자라면 409 SHOP_003 이다.
 */
const SHOP_ITEMS: readonly ShopItemDto[] = [
  { itemId: 1, itemCategory: "AVATAR", slotType: "HEAD", name: "노란 비니", price: 150, assetKey: "beanie_yellow", themeCode: null, owned: false },
  { itemId: 2, itemCategory: "AVATAR", slotType: "HEAD", name: "가을 털모자", price: 300, assetKey: "hat_autumn", themeCode: "AUTUMN", owned: false },
  { itemId: 3, itemCategory: "AVATAR", slotType: "FACE", name: "동그란 안경", price: 120, assetKey: "glasses_round", themeCode: null, owned: true },
  { itemId: 4, itemCategory: "AVATAR", slotType: "UPPER_BODY", name: "기본 티셔츠", price: 0, assetKey: "tee_basic", themeCode: null, owned: false },
  { itemId: 5, itemCategory: "AVATAR", slotType: "UPPER_BODY", name: "니트 가디건", price: 400, assetKey: "cardigan_knit", themeCode: "AUTUMN", owned: false },
  { itemId: 6, itemCategory: "AVATAR", slotType: "LOWER_BODY", name: "청바지", price: 250, assetKey: "jeans_blue", themeCode: null, owned: false },
  { itemId: 7, itemCategory: "AVATAR", slotType: "SOCKS", name: "줄무늬 양말", price: 80, assetKey: "socks_stripe", themeCode: null, owned: false },
  { itemId: 8, itemCategory: "AVATAR", slotType: "FOOTWEAR", name: "운동화", price: 2000, assetKey: "sneakers_white", themeCode: null, owned: false },
  { itemId: 9, itemCategory: "FURNITURE", slotType: "FLOOR", name: "책상", price: 500, assetKey: "desk_default", themeCode: null, owned: false },
  { itemId: 10, itemCategory: "FURNITURE", slotType: "FLOOR", name: "화분", price: 200, assetKey: "plant_default", themeCode: null, owned: true },
  { itemId: 11, itemCategory: "FURNITURE", slotType: "FLOOR", name: "냉장고", price: 900, assetKey: "fridge_default", themeCode: null, owned: false },
  { itemId: 12, itemCategory: "FURNITURE", slotType: "WALL", name: "벽 캘린더", price: 300, assetKey: "calendar_default", themeCode: null, owned: true },
];

/** 이번 실행에서 산 상품과 그만큼 빠진 코인. 잔액 목이 함께 줄어든다 */
const purchased = new Set<number>();
let spent = 0;

export function shopItemsMock(): ShopItemDto[] {
  return SHOP_ITEMS.map((item) => ({ ...item, owned: item.owned || purchased.has(item.itemId) }));
}

export function purchaseShopItemMock(request: ShopPurchaseRequest): ShopPurchaseDto {
  const item = shopItemsMock().find((candidate) => candidate.itemId === request.itemId);
  if (item === undefined) throw new ApiError(400, "COMMON_001", "상품을 찾을 수 없습니다.");
  if (item.owned) throw new ApiError(409, "SHOP_002", "이미 보유한 상품입니다.");
  if (BALANCE - spent < item.price) throw new ApiError(409, "SHOP_003", "코인이 부족합니다.");

  purchased.add(item.itemId);
  spent += item.price;
  const isAvatar = item.itemCategory === "AVATAR";
  return {
    itemId: item.itemId,
    itemCategory: item.itemCategory,
    userItemId: isAvatar ? 500 + item.itemId : null,
    userFurnitureId: isAvatar ? null : 600 + item.itemId,
    price: item.price,
    balance: BALANCE - spent,
  };
}

export function resetShopMocks(): void {
  purchased.clear();
  spent = 0;
}
