import { ContractMismatchError } from "@/lib/contract";

/**
 * 방 씬의 좌표계와 순수 함수. 씬 단위는 Pencil CharacterRoom(Plvf1) 327×404 pt 를 그대로 쓴다.
 * 기기 폭에 맞춰 scale 만 곱하므로 배치·저장 좌표는 항상 씬 단위다(픽셀 아님).
 * Reanimated 워크릿 안에서도 부르므로 순수 함수마다 "worklet" 지시자를 둔다.
 */
export const SCENE_WIDTH = 327;
export const SCENE_HEIGHT = 404;
export const SCENE_ASPECT_RATIO = SCENE_WIDTH / SCENE_HEIGHT;

export type ScenePoint = { x: number; y: number };
export type SceneSize = { width: number; height: number };
export type SceneRect = ScenePoint & SceneSize;
export type ScenePolygon = ScenePoint[];

/** 스프라이트의 기준점 비율. 기본은 발끝(가로 중앙, 세로 95%)이라 y정렬과 배치 좌표의 기준이 된다. */
export type AnchorRatio = { x: number; y: number };
export const FOOT_ANCHOR: AnchorRatio = { x: 0.5, y: 0.95 };

/**
 * 깊이 정렬 대상. painter's algorithm: layer 오름차순, 같은 layer 안에서는 기준점 y(발끝) 오름차순으로 그린다.
 * 화면 아래쪽(y 큰 값)에 있는 것이 앞에 오므로 나중에 그려 앞을 가린다.
 * layer 는 소파처럼 캐릭터가 앞뒤로 걸치는 가구를 위한 보정값이며 기본 0 이다.
 */
export type DepthEntity = { anchor: ScenePoint; layer?: number };

export function getSceneScale(canvasWidth: number): number {
  "worklet";
  return canvasWidth / SCENE_WIDTH;
}

export function getCanvasSize(canvasWidth: number): SceneSize {
  "worklet";
  return { width: canvasWidth, height: canvasWidth / SCENE_ASPECT_RATIO };
}

export function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

/** 기준점(씬 단위)과 크기로 스프라이트의 좌상단 사각형을 구한다. */
export function getSpriteRect(anchor: ScenePoint, size: SceneSize, anchorRatio: AnchorRatio = FOOT_ANCHOR): SceneRect {
  "worklet";
  return {
    x: anchor.x - size.width * anchorRatio.x,
    y: anchor.y - size.height * anchorRatio.y,
    width: size.width,
    height: size.height,
  };
}

/** 씬 단위 사각형을 캔버스 픽셀 사각형으로 바꾼다. */
export function sceneRectToCanvas(rect: SceneRect, scale: number): SceneRect {
  "worklet";
  return { x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
}

/** 깊이 정렬 키. 작을수록 먼저(뒤에) 그린다. */
export function depthKey(entity: DepthEntity): number {
  "worklet";
  return (entity.layer ?? 0) * SCENE_HEIGHT * 2 + entity.anchor.y;
}

/** painter's algorithm 순서로 정렬한 새 배열을 돌려준다(입력은 바꾸지 않는다). 키가 같으면 입력 순서를 유지한다. */
export function sortByDepth<T extends DepthEntity>(entities: readonly T[]): T[] {
  return entities
    .map((entity, index) => ({ entity, index }))
    .sort((a, b) => depthKey(a.entity) - depthKey(b.entity) || a.index - b.index)
    .map(({ entity }) => entity);
}

/**
 * 이미 정렬된 배열에서 움직이는 개체(기준점 y, layer)가 들어갈 위치를 구한다.
 * 반환값 i 는 "앞의 i개를 그린 뒤 개체를 그리고 나머지를 그린다"는 뜻이다. 워크릿에서 매 프레임 불러도 싼 선형 탐색이다.
 */
export function depthIndexAt(sortedKeys: readonly number[], anchorY: number, layer = 0): number {
  "worklet";
  const key = layer * SCENE_HEIGHT * 2 + anchorY;
  let index = 0;
  while (index < sortedKeys.length && sortedKeys[index] <= key) index++;
  return index;
}

/** 점이 다각형 안에 있는지(ray casting). 경계 위의 점은 구현상 안팎이 갈릴 수 있으므로 걷기 영역은 여유를 두고 정의한다. */
export function isPointInPolygon(point: ScenePoint, polygon: ScenePolygon): boolean {
  "worklet";
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distance(a: ScenePoint, b: ScenePoint): number {
  "worklet";
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function rectContainsPoint(rect: SceneRect, point: ScenePoint): boolean {
  "worklet";
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function getPolygonBounds(polygon: ScenePolygon): SceneRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 선분 a→b 를 step 간격으로 샘플링해 사각형을 지나는지 본다. 가구 사이를 "통과"하는 경로를 거르는 용도라 근사로 충분하다. */
export function segmentCrossesRect(a: ScenePoint, b: ScenePoint, rect: SceneRect, step = 6): boolean {
  const length = distance(a, b);
  const steps = Math.max(1, Math.ceil(length / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (rectContainsPoint(rect, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return true;
  }
  return false;
}

/** 0 이상 1 미만의 난수를 주는 함수. 테스트에서는 고정 수열을 넣는다. */
export type Rng = () => number;

export type PickWaypointOptions = {
  from: ScenePoint;
  polygon: ScenePolygon;
  /** 발끝이 들어가면 안 되는 영역(가구 발자국). 경로가 지나가도 안 된다 */
  blocked?: readonly SceneRect[];
  rng?: Rng;
  /** 이 거리보다 가까운 후보는 버린다(제자리 걸음 방지) */
  minDistance?: number;
  /** 벽에서 이만큼 위쪽 점도 다각형 안에 있어야 한다(캐릭터 몸이 벽에 붙지 않게) */
  wallMargin?: number;
  /** 좌우 가장자리에서 이만큼 안쪽만 고른다(스프라이트 폭의 절반 이상이어야 화면 밖으로 안 잘린다) */
  xInset?: number;
  maxTries?: number;
};

/** 걷기 가능 영역 안에서 다음 목적지를 고른다. 조건을 만족하는 점을 못 찾으면 null. */
export function pickWaypoint({
  from,
  polygon,
  blocked = [],
  rng = Math.random,
  minDistance = 40,
  wallMargin = 12,
  xInset = 0,
  maxTries = 40,
}: PickWaypointOptions): ScenePoint | null {
  const bounds = getPolygonBounds(polygon);
  const minX = bounds.x + xInset;
  const maxX = bounds.x + bounds.width - xInset;
  if (maxX <= minX) return null;
  for (let i = 0; i < maxTries; i++) {
    const candidate = { x: minX + rng() * (maxX - minX), y: bounds.y + rng() * bounds.height };
    if (!isPointInPolygon(candidate, polygon)) continue;
    if (!isPointInPolygon({ x: candidate.x, y: candidate.y - wallMargin }, polygon)) continue;
    if (distance(from, candidate) < minDistance) continue;
    if (blocked.some((rect) => rectContainsPoint(rect, candidate))) continue;
    if (blocked.some((rect) => segmentCrossesRect(from, candidate, rect))) continue;
    return candidate;
  }
  return null;
}

/** 일정 속도(씬 단위/초)로 이동할 때 걸리는 시간(ms) */
export function travelDurationMs(from: ScenePoint, to: ScenePoint, speed: number): number {
  return Math.round((distance(from, to) / speed) * 1000);
}

export function rectsIntersect(a: SceneRect, b: SceneRect): boolean {
  "worklet";
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export type HitTarget<TId> = { id: TId; rect: SceneRect };

/** 그리는 순서(뒤→앞)로 주어진 사각형들 중 점을 포함하는 가장 앞의 것을 고른다. 없으면 null. */
export function hitTestTopmost<TId>(point: ScenePoint, targets: readonly HitTarget<TId>[]): TId | null {
  for (let i = targets.length - 1; i >= 0; i--) {
    if (rectContainsPoint(targets[i].rect, point)) return targets[i].id;
  }
  return null;
}

/* ───────────── 서버 계약: GET /room (docs/api-contract.md GAME, FR-GAM-01) ───────────── */

export const SLOT_TYPES = ["WALLPAPER", "FLOOR", "FURNITURE", "HAIR", "OUTFIT", "FACE"] as const;
export type KnownSlotType = (typeof SLOT_TYPES)[number];
/** 계약에 없는 값은 UNKNOWN 으로 흡수한다 (규칙 90) */
export type SlotType = KnownSlotType | "UNKNOWN";

export type RoomDto = {
  theme: string;
  avatar: {
    equipped: { slotType: string; itemId: number; assetKey: string }[];
    reaction: { type: string; until: string } | null;
  };
  coin: { balance: number };
  board: { month: string; totalRemainingRate: number };
  attendance: { checkedToday: boolean };
  stickers?: { count: number; total: number; removableToday: boolean };
  overEnvelopes?: number[];
};

export type EquippedItem = { slotType: SlotType; itemId: number; assetKey: string };
/** type 값 목록은 미확정(frontend-spec §6 #2). until 은 시간대 없는 KST 문자열 */
export type AvatarReaction = { type: string; until: string };
export type RoomStickers = { count: number; total: number; removableToday: boolean };

export type Room = {
  theme: string;
  equipped: EquippedItem[];
  reaction: AvatarReaction | null;
  coinBalance: number;
  board: { month: string; totalRemainingRate: number };
  checkedInToday: boolean;
  /** P1 압류 딱지. 응답에 없으면 null */
  stickers: RoomStickers | null;
  /** P1 초과 봉투 id. 응답에 없으면 빈 배열 */
  overEnvelopeIds: number[];
};

const MONTH_KEY = /^\d{6}$/;

function isKnownSlotType(value: string): value is KnownSlotType {
  return (SLOT_TYPES as readonly string[]).includes(value);
}

export function toRoom(dto: RoomDto): Room {
  if (!Number.isSafeInteger(dto.coin.balance) || dto.coin.balance < 0) throw new ContractMismatchError("coin.balance");
  if (!MONTH_KEY.test(dto.board.month)) throw new ContractMismatchError("board.month");
  if (!Number.isInteger(dto.board.totalRemainingRate)) throw new ContractMismatchError("board.totalRemainingRate");

  return {
    theme: dto.theme,
    equipped: dto.avatar.equipped.map((item) => ({
      slotType: isKnownSlotType(item.slotType) ? item.slotType : "UNKNOWN",
      itemId: item.itemId,
      assetKey: item.assetKey,
    })),
    reaction: dto.avatar.reaction,
    coinBalance: dto.coin.balance,
    board: { month: dto.board.month, totalRemainingRate: dto.board.totalRemainingRate },
    checkedInToday: dto.attendance.checkedToday,
    stickers: dto.stickers ?? null,
    overEnvelopeIds: dto.overEnvelopes ?? [],
  };
}

/* ───────────── 서버 계약: POST /attendance (docs/api-contract.md GAME, FR-GAM-03) ───────────── */

/** granted 는 이번 요청에서 지급된 코인(당일 이미 출석했으면 0), balance 는 지급 후 잔액 */
export type AttendanceDto = { granted: number; balance: number };
export type Attendance = { granted: number; balance: number };

export function toAttendance(dto: AttendanceDto): Attendance {
  if (!Number.isSafeInteger(dto.granted) || dto.granted < 0) throw new ContractMismatchError("granted");
  if (!Number.isSafeInteger(dto.balance) || dto.balance < 0) throw new ContractMismatchError("balance");
  return { granted: dto.granted, balance: dto.balance };
}
