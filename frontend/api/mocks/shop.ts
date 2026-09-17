import type { CoinBalanceDto, CoinHistoryDto, CoinHistoryItemDto } from "@/features/shop/model";
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
  return { balance: BALANCE };
}
