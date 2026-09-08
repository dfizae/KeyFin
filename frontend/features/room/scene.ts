import type { FurnitureItem, FurnitureId } from "@/features/room/catalog";
import {
  getSpriteRect,
  isPointInPolygon,
  rectsIntersect,
  SCENE_WIDTH,
  type ScenePoint,
  type ScenePolygon,
  type SceneRect,
  type SceneSize,
} from "@/features/room/model";

/**
 * 씬 배치. 좌표는 모두 씬 단위(327×404)이며 anchor 는 가구 발끝(바닥에 닿는 점)이다.
 * 백엔드 `GET/PUT /room/layout` 이 생기면 이 파일의 DEFAULT_LAYOUT 은 목 데이터로 옮긴다. (TBD, 3단계)
 */
export type Placement = {
  itemId: FurnitureId;
  anchor: ScenePoint;
  /** 깊이 보정. 카탈로그 layer 보다 우선한다 */
  layer?: number;
};

/**
 * 바닥 다각형. assets/sprites/floors/floor-default.png 의 걸레받이를 씬 단위로 옮긴 값이다.
 * 왼쪽 벽 (0,171)→코너 (131,112)→오른쪽 벽 (327,200), 아래는 화면 끝. 바닥을 다시 만들면 같이 갱신한다.
 */
export const FLOOR_POLYGON: ScenePolygon = [
  { x: 0, y: 171 },
  { x: 131, y: 112 },
  { x: 327, y: 200 },
  { x: 327, y: 404 },
  { x: 0, y: 404 },
];

/** 기준 이미지(홈 룸)의 배치를 따른 기본 배치: 창가 화분, 오른쪽 벽에 냉장고·책상, 가운데 소파와 테이블 */
export const DEFAULT_LAYOUT: readonly Placement[] = [
  { itemId: "plant", anchor: { x: 55, y: 172 } },
  { itemId: "fridge", anchor: { x: 168, y: 152 } },
  { itemId: "desk", anchor: { x: 262, y: 205 } },
  { itemId: "sofa", anchor: { x: 100, y: 284 } },
  { itemId: "coffee-table", anchor: { x: 190, y: 335 } },
];

/**
 * 가구가 바닥에서 차지하는 발자국. 캐릭터 발끝이 들어가거나 경로가 지나가면 안 되는 영역이다.
 * 스프라이트 사각형의 아래쪽 45%(바닥에 닿는 부분)에 앞쪽 여유를 조금 더한다. 정밀한 값이 필요하면 카탈로그에 항목별로 둔다.
 */
export function getFootprintRect(item: FurnitureItem, anchor: ScenePoint): SceneRect {
  const rect = getSpriteRect(anchor, item.size, item.anchor);
  const depth = item.size.height * 0.45;
  return { x: rect.x + rect.width * 0.1, y: anchor.y - depth, width: rect.width * 0.8, height: depth + 10 };
}

/** 가구를 벽에서 이만큼 띄운다(발끝 기준). 캐릭터 wallMargin 과 같은 값 */
export const WALL_MARGIN = 12;

type PlacementCheck = {
  item: FurnitureItem;
  anchor: ScenePoint;
  /** 자기 자신을 뺀 나머지 가구의 발자국 */
  otherFootprints: readonly SceneRect[];
  polygon?: ScenePolygon;
};

/**
 * 배치가 유효한지: 발끝이 바닥 안(벽 마진 포함), 스프라이트가 좌우 화면 안, 다른 가구 발자국과 겹치지 않음.
 * 편집 모드 드래그와 3단계 서버 응답 검증에 같이 쓴다.
 */
export function isPlacementValid({ item, anchor, otherFootprints, polygon = FLOOR_POLYGON }: PlacementCheck): boolean {
  if (!isPointInPolygon(anchor, polygon)) return false;
  if (!isPointInPolygon({ x: anchor.x, y: anchor.y - WALL_MARGIN }, polygon)) return false;
  const rect = getSpriteRect(anchor, item.size, item.anchor);
  if (rect.x < 0 || rect.x + rect.width > SCENE_WIDTH) return false;
  const footprint = getFootprintRect(item, anchor);
  return !otherFootprints.some((other) => rectsIntersect(footprint, other));
}

/**
 * 드래그 이동을 유효한 위치로 해석한다. 그대로 갈 수 있으면 그 자리, 아니면 가로만·세로만 움직여 보고,
 * 그래도 안 되면 출발점에 머문다(벽이나 가구에 걸리면 미끄러지듯 멈춘다).
 */
export function resolveDrag(check: Omit<PlacementCheck, "anchor">, from: ScenePoint, delta: ScenePoint): ScenePoint {
  const candidates: ScenePoint[] = [
    { x: from.x + delta.x, y: from.y + delta.y },
    { x: from.x + delta.x, y: from.y },
    { x: from.x, y: from.y + delta.y },
  ];
  for (const anchor of candidates) {
    if (isPlacementValid({ ...check, anchor })) return anchor;
  }
  return from;
}

/** 캐릭터 정지 이미지의 씬 단위 크기(char1-idle.png 496×756 비율) */
export const CHARACTER_SIZE: SceneSize = { width: 72, height: 110 };

/** 캐릭터 이동 파라미터. 시트 없이 정지 이미지 + 코드 모션으로 "움직이는 느낌"만 낸다. */
export const CHARACTER_MOTION = {
  /** 처음 서 있는 자리(테이블 앞) */
  start: { x: 160, y: 352 } as ScenePoint,
  /** 씬 단위/초 */
  speed: 42,
  /** 도착 후 다음 이동까지 쉬는 시간(ms) */
  idleWaitMs: { min: 3000, max: 6000 },
  /** 이동 중 잔걸음 바운스 높이(씬 단위)와 주기(ms) */
  bob: { height: 3, periodMs: 360 },
  /** 멈춰 있을 때 호흡 스케일 폭과 주기(ms) */
  breath: { amount: 0.018, periodMs: 1700 },
} as const;
