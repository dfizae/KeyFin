import { HALF_PER_CELL, type GridFootprint } from "@/features/room/grid";
import type { AnchorRatio, SceneSize, Surface } from "@/features/room/model";

/**
 * 가구 정의. 백엔드 `GET /room/catalog` 가 생기면 그 응답으로 대체하고 여기는 스프라이트 require 만 남긴다. (TBD)
 * - sprite: assets/sprites/furniture 의 투명 PNG. 소파·책상·냉장고·화분은 격자 정렬용으로 다시 생성했다
 *   (2026-09-09, Pencil AI → remove-white-bg.ps1 -KeyColor "#FF00FF"). 그림자가 없어 스프라이트 전체가 본체다.
 * - size: 씬 단위 크기. 캐릭터(110 = 사람 1.7m)를 기준으로 실제 치수에서 계산한다(scene.ts SCALE 참고).
 *   가로 = 실제 가로(m) ÷ 0.86 × 44.9 + 실제 깊이(m) ÷ 0.86 × 48.25. 눈대중으로 조정하지 않는다.
 * - anchor: 접지면 무게중심의 이미지 내 비율. 이 점이 칸의 무게중심에 놓인다(grid.ts cellAnchor).
 *   다리가 있는 가구는 다리 접지점 셋으로 평행사변형을 복원해 무게중심을 구했고,
 *   화분은 밑동 타원의 중심, 상자는 실루엣 중심 x 와 발자국 높이의 절반을 올린 y 를 썼다.
 */
export type FurnitureId = "sofa" | "coffee-table" | "desk" | "fridge" | "plant";

export type FurnitureItem = {
  id: FurnitureId;
  name: string;
  /** 서버 items.asset_key. 이 값으로 GET /room·/furnitures 응답을 스프라이트에 잇는다 (3단계) */
  assetKey: string;
  sprite: number;
  size: SceneSize;
  anchor: AnchorRatio;
  /**
   * 바닥에서 차지하는 칸(반 칸 단위). 배치 스냅·겹침 판정의 근거다.
   * cells(가로, 깊이) 로 적으며 그림자가 아니라 바닥에 닿는 본체만 센다. solid 주석 참고.
   */
  grid: GridFootprint;
  /** 캐릭터가 앞뒤로 걸치는 가구의 깊이 보정. 기본 0 */
  layer?: number;
};

/**
 * 발자국을 칸 수로 적는다. cells(가로, 세로). 저장 단위가 반 칸이라 1.5 처럼 반 칸 단위도 쓸 수 있다.
 * 격자의 두 축은 화면에서 기울어 있다. 화면 기준 가로로 읽히는 쪽이 격자의 row 축(왼쪽 벽과 나란함),
 * 세로로 읽히는 쪽이 col 축(오른쪽 벽과 나란함)이라 저장 형식(w=col, d=row)에는 바꿔 넣는다.
 */
const cells = (across: number, deep: number): GridFootprint => ({ w: deep * HALF_PER_CELL, d: across * HALF_PER_CELL });

const ratio = (width: number, pngWidth: number, pngHeight: number): SceneSize => ({
  width,
  height: Math.round((width * pngHeight) / pngWidth),
});

export const FURNITURE: Record<FurnitureId, FurnitureItem> = {
  sofa: {
    id: "sofa",
    assetKey: "sofa_default",
    name: "소파",
    sprite: require("@/assets/sprites/furniture/sofa.png"),
    // 다리 접지점 (80,504)·(265,616)·(749,416) → 긴 변 523.7px(각도 22.5도)
    size: ratio(144, 828, 624), // 1.8m x 0.9m x 0.8m
    anchor: { x: 0.501, y: 0.737 }, // 접지면 무게중심 (414.5, 460)
    grid: cells(2, 1),
  },
  "coffee-table": {
    id: "coffee-table",
    assetKey: "table_default",
    name: "테이블",
    // 격자 정렬용 재생성 대상이 아직 아니다(상점 도입 시 다른 가구와 같은 절차로 다시 만든다).
    sprite: require("@/assets/sprites/furniture/coffee-table.png"),
    // solid: PNG 507x471 중 본체 x 6~498 · 아래 463. 그림자가 거의 없다.
    size: ratio(51, 507, 471), // 본체 50 = 가로 1칸
    anchor: { x: 0.497, y: 0.983 },
    grid: cells(1, 1),
  },
  desk: {
    id: "desk",
    assetKey: "desk_default",
    name: "책상",
    sprite: require("@/assets/sprites/furniture/desk.png"),
    // 다리 접지점 (72,535)·(271,671)·(743,442) → 긴 변 524.6px(각도 25.9도)
    size: ratio(96, 810, 679), // 1.2m x 0.6m x 0.75m
    anchor: { x: 0.503, y: 0.719 }, // 접지면 무게중심 (407.5, 488.5)
    grid: cells(1.5, 1),
  },
  fridge: {
    id: "fridge",
    assetKey: "fridge_default",
    name: "냉장고",
    sprite: require("@/assets/sprites/furniture/fridge.png"),
    // 상자형이라 접지면이 곧 본체 바닥이다. 종횡비 1.37 이라 키를 기준(1.7m)에 맞췄고
    // 그때 폭 90 = 실제 0.83m 로 한 칸(0.86m) 안에 들어간다.
    size: ratio(90, 506, 691), // 0.83m x 0.83m x 1.7m
    anchor: { x: 0.499, y: 0.813 }, // 발자국 높이 242px 의 절반을 최하점에서 올린 값
    grid: cells(1, 1),
  },
  plant: {
    id: "plant",
    assetKey: "plant_default",
    name: "화분",
    sprite: require("@/assets/sprites/furniture/plant.png"),
    // 화분 밑면은 한 칸보다 작다.
    size: ratio(54, 473, 606), // 0.5m x 0.5m x 0.8m
    anchor: { x: 0.513, y: 0.810 }, // 밑동 타원 중심 (242.5, 491)
    grid: cells(1, 1),
  },
};

/**
 * 벽에 붙는 오브젝트. 바닥 격자가 아니라 벽면 격자(scene.ts SURFACES.WALL_*)에 놓이고, 편집 모드에서 자기 벽 안에서만 옮긴다
 * (사용자 결정 2026-09-15: 벽 에셋은 바닥에 놓지 않되 벽 위에서는 드래그로 이동). 벽걸이는 전부 1×1 칸이고 에셋 위에 글자를 얹지 않는다 —
 * 숫자·막대는 탭해서 여는 팝오버가 보여준다(사용자 결정 2026-09-15).
 * - sprite: Pencil AI 생성(에셋 생성 (AI) 프레임 wall-board·wall-calendar, 마젠타 키) → remove-white-bg.ps1. 임시 에셋이며 사용자가 직접 만든 이미지로 바꾼다.
 * - size: 씬 단위. 벽 한 칸(왼쪽 45×58, 오른쪽 48×63) 안에 들어가도록 폭 44 를 기준으로 PNG 비율을 지켰다.
 * - anchor: 스프라이트 중심. 이 점이 벽 칸의 중심(cellAnchor)에 놓인다.
 */
export type WallItemId = "board" | "calendar";
export type WallSurface = Exclude<Surface, "FLOOR">;
/** 방에 놓이는 모든 오브젝트 id. 배치(Placement)·선택·드래그가 이 타입으로 통한다 */
export type RoomItemId = FurnitureId | WallItemId;

export type WallItem = {
  id: WallItemId;
  name: string;
  /** 서버 items.asset_key */
  assetKey: string;
  sprite: number;
  size: SceneSize;
  anchor: AnchorRatio;
  grid: GridFootprint;
  /** 붙는 벽. 다른 벽으로는 옮기지 않는다 */
  surface: WallSurface;
};

/** 벽 칸은 col 이 벽을 따라가는 가로, row 가 세로다(바닥과 달리 축을 바꾸지 않는다) */
const wallCells = (along: number, down: number): GridFootprint => ({ w: along * HALF_PER_CELL, d: down * HALF_PER_CELL });

const CENTER: AnchorRatio = { x: 0.5, y: 0.5 };
/** 벽걸이는 전부 같은 크기다(사용자 요청 2026-09-15). 생성 프레임 72×90 비율, 벽 한 칸(48×63) 안에 든다 */
const WALL_ITEM_SIZE: SceneSize = { width: 44, height: 55 };

export const WALL_ITEMS: Record<WallItemId, WallItem> = {
  board: {
    id: "board",
    assetKey: "board_default",
    name: "예산 보드",
    sprite: require("@/assets/sprites/wall/board.png"),
    size: WALL_ITEM_SIZE,
    anchor: CENTER,
    grid: wallCells(1, 1),
    surface: "WALL_RIGHT",
  },
  calendar: {
    id: "calendar",
    assetKey: "calendar_default",
    name: "출금 캘린더",
    sprite: require("@/assets/sprites/wall/calendar.png"),
    size: WALL_ITEM_SIZE,
    anchor: CENTER,
    grid: wallCells(1, 1),
    surface: "WALL_RIGHT",
  },
};

export function isWallItemId(id: RoomItemId): id is WallItemId {
  return id in WALL_ITEMS;
}

/**
 * 서버 assetKey → 방 오브젝트 id. 값은 Swagger 예시(`sofa_default`·`sofa_blue`)를 따른 추정이며
 * 백엔드 아이템 시드가 들어오면 그 값으로 맞춘다 (TBD). 모르는 키는 undefined 라 화면이 건너뛴다 (규칙 90).
 */
const ITEM_ID_BY_ASSET_KEY: Record<string, RoomItemId> = Object.fromEntries([
  ...Object.values(FURNITURE).map((item) => [item.assetKey, item.id] as const),
  ...Object.values(WALL_ITEMS).map((item) => [item.assetKey, item.id] as const),
]);

export function roomItemIdByAssetKey(assetKey: string): RoomItemId | undefined {
  return ITEM_ID_BY_ASSET_KEY[assetKey];
}

/** 배치·드래그가 쓰는 공통 정의(크기·앵커·격자). 벽 오브젝트와 가구를 한 자리에서 꺼낸다 */
export function roomItem(id: RoomItemId): FurnitureItem | WallItem {
  return isWallItemId(id) ? WALL_ITEMS[id] : FURNITURE[id];
}
