import { FURNITURE, type FurnitureItem, type FurnitureId } from "@/features/room/catalog";
import { anchorToCell, cellAnchor, cellCorners, type GridCell, type GridFootprint, type SurfaceDef } from "@/features/room/grid";
import { isPointInPolygon, type ScenePoint, type ScenePolygon, type SceneSize, type Surface } from "@/features/room/model";

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
 * 바닥 다각형. floor-default.png 의 걸레받이 아래쪽 경계를 픽셀로 훑어 최소자승으로 피팅한 값이다(표본 94개).
 * 왼쪽 벽 (0,188)→코너 (134,125)→오른쪽 벽 (327,219), 아래는 화면 끝. 바닥을 다시 만들면 같이 갱신한다.
 */
export const FLOOR_POLYGON: ScenePolygon = [
  { x: 0, y: 188 },
  { x: 134, y: 125 },
  { x: 327, y: 219 },
  { x: 327, y: 404 },
  { x: 0, y: 404 },
];

/**
 * 배치 격자를 얹는 세 면. 벽·바닥 경계선은 floor-default.png 를 픽셀로 재서 얻었다(표본 94개, 2026-09-09).
 *   좌측 벽선 y = -0.4721x + 188.07 · 우측 벽선 y = 0.4891x + 59.29 · 교점 (134, 125)
 *
 * 세 면 모두 평행사변형이다. 같은 이미지의 창틀 윗선(기울기 -0.4503)과 걸레받이선(-0.4721)이 거의 평행이라
 * 이 방 그림에는 원근이 사실상 없다. 사영변환으로 원근을 넣으면 칸 크기가 제각각이 되어 그림과 어긋난다.
 *
 * 바닥 격자는 보이는 바닥 전체를 덮도록 화면 밖까지 뻗는다(64칸 중 화면 안은 38칸).
 * 화면 밖 칸에 놓이지 않게 막는 것은 isPlaceableOnFloor 가 한다.
 */
export const SURFACES: Record<Surface, SurfaceDef> = {
  // col 은 오른쪽 벽 방향, row 는 왼쪽 벽 방향. 둘 다 화면 앞쪽으로 증가한다.
  FLOOR: {
    quad: [
      { x: 134, y: 125 },
      { x: 520, y: 313 },
      { x: 161, y: 482 },
      { x: -225, y: 294 },
    ],
    cols: 8,
    rows: 8,
  },
  // 벽은 걸레받이를 따라가는 방향이 col, 수직이 row 다. 벽면은 수직이라 행 경계는 화면에서도 수평이다.
  // 왼쪽 벽은 폭 134, 오른쪽은 193 이라 칸 폭을 맞추려고 칸 수를 다르게 뒀다(24.7 대 26.9, 차이 8%).
  WALL_LEFT: {
    quad: [
      { x: 0, y: 15 },
      { x: 134, y: -48 },
      { x: 134, y: 125 },
      { x: 0, y: 188 },
    ],
    cols: 6,
    rows: 7,
  },
  WALL_RIGHT: {
    quad: [
      { x: 134, y: -63 },
      { x: 327, y: 31 },
      { x: 327, y: 219 },
      { x: 134, y: 125 },
    ],
    cols: 8,
    rows: 7,
  },
};

/** 경계 위의 점은 다각형 판정에서 안팎이 갈리므로 꼭짓점을 발자국 안쪽으로 이만큼 당겨서 본다. */
const EDGE_INSET = 0.02;

/**
 * 바닥에 실제로 놓을 수 있는 자리인지. 격자가 화면 밖까지 뻗어 있으므로
 * 발자국 네 꼭짓점이 모두 보이는 바닥 안에 들어와야 한다.
 * 벽에 딱 붙인 가구는 꼭짓점이 걸레받이선 위에 놓이므로 안쪽으로 당겨 판정한다.
 */
export function isPlaceableOnFloor(cell: GridCell, footprint: GridFootprint): boolean {
  const corners = cellCorners(SURFACES.FLOOR, cell, footprint);
  const center = corners.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
  return corners.every((corner) =>
    isPointInPolygon(
      { x: corner.x + (center.x - corner.x) * EDGE_INSET, y: corner.y + (center.y - corner.y) * EDGE_INSET },
      FLOOR_POLYGON
    )
  );
}

/**
 * 기본 배치. 칸으로 정의하고 발끝 좌표는 격자에서 파생시킨다.
 * 기준 이미지(홈 룸)의 구도를 따랐다: 창가 화분, 뒷벽에 책상·냉장고, 가운데 소파.
 * 테이블은 상점에서 산 가구를 골라 배치하는 흐름으로 옮기기로 해 기본 배치에서 뺐다(2026-09-09).
 * 서버(GET /room/layout)가 생기면 이 배열이 목 데이터의 placements 가 된다.
 */
export const DEFAULT_CELLS: readonly { itemId: FurnitureId; cell: GridCell }[] = [
  { itemId: "desk", cell: { col: 2, row: 0 } },
  { itemId: "fridge", cell: { col: 6, row: 0 } },
  { itemId: "plant", cell: { col: 0, row: 4 } },
  { itemId: "sofa", cell: { col: 4, row: 2 } },
];

export const DEFAULT_LAYOUT: readonly Placement[] = DEFAULT_CELLS.map(({ itemId, cell }) => ({
  itemId,
  anchor: cellAnchor(SURFACES.FLOOR, cell, FURNITURE[itemId].grid),
}));

/**
 * 가구가 바닥에서 차지하는 발자국. 캐릭터 발끝이 들어가거나 경로가 지나가면 안 되는 영역이며,
 * 배치 격자의 칸을 씬 좌표로 되돌린 평행사변형이라 배치·겹침 판정과 같은 근거를 쓴다.
 * 축 정렬 사각형으로 감싸면 실제 넓이의 두 배가 되어 캐릭터가 갈 곳을 잃는다.
 */
export function getFootprintPolygon(item: FurnitureItem, anchor: ScenePoint): ScenePolygon {
  const cell = anchorToCell(SURFACES.FLOOR, anchor, item.grid);
  return cellCorners(SURFACES.FLOOR, cell, item.grid);
}

/** 캐릭터 정지 이미지의 씬 단위 크기(char1-idle.png 496×756 비율) */
export const CHARACTER_SIZE: SceneSize = { width: 72, height: 110 };

/** 캐릭터 이동 파라미터. 시트 없이 정지 이미지 + 코드 모션으로 "움직이는 느낌"만 낸다. */
export const CHARACTER_MOTION = {
  /** 서 있는 자리. 방 가로 정중앙이며 가구 발자국과 겹치지 않는다. */
  start: { x: 163, y: 350 } as ScenePoint,
  /** 씬 단위/초 */
  speed: 42,
  /** 도착 후 다음 이동까지 쉬는 시간(ms) */
  idleWaitMs: { min: 3000, max: 6000 },
  /** 이동 중 잔걸음 바운스 높이(씬 단위)와 주기(ms) */
  bob: { height: 3, periodMs: 360 },
  /** 멈춰 있을 때 호흡 스케일 폭과 주기(ms) */
  breath: { amount: 0.018, periodMs: 1700 },
} as const;
