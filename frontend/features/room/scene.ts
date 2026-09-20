import {
  FURNITURE,
  WALL_ITEMS,
  isWallItemId,
  roomItem,
  type FurnitureId,
  type FurnitureItem,
  type RoomItemId,
  type WallItemId,
  type WallSurface,
} from "@/features/room/catalog";
import {
  anchorToCell,
  cellAnchor,
  cellCorners,
  cellsOverlap,
  fitsOnSurface,
  HALF_PER_CELL,
  type GridCell,
  type GridFootprint,
  type SurfaceDef,
} from "@/features/room/grid";
import {
  SCENE_HEIGHT,
  SCENE_WIDTH,
  distance,
  getSpriteRect,
  isPointInPolygon,
  type ScenePoint,
  type ScenePolygon,
  type SceneRect,
  type SceneSize,
  type Surface,
} from "@/features/room/model";

/**
 * 씬 배치. 좌표는 모두 씬 단위(327×404)이며 anchor 는 가구는 발끝(바닥에 닿는 점), 벽 오브젝트는 스프라이트 중심이다.
 * surface 가 없으면 바닥이다. 백엔드 `user_furnitures.placement_status`(FLOOR/LEFT_WALL/RIGHT_WALL)와 같은 뜻이고
 * 변환은 furniture.ts 가 한다. DEFAULT_LAYOUT 은 서버에 설치된 가구가 없을 때 쓰는 폴백이다(아이템 시드 전까지, 2026-09-16).
 */
export type Placement = {
  itemId: RoomItemId;
  /** 서버 보유 가구 id (GET /room·/furnitures). 기본 배치 폴백에는 없어 저장 대상에서 빠진다 (3단계) */
  userFurnitureId?: number;
  anchor: ScenePoint;
  /** 깊이 보정. 카탈로그 layer 보다 우선한다 */
  layer?: number;
  /** 놓인 면. 생략하면 FLOOR */
  surface?: Surface;
};

/**
 * 바닥 다각형. floor-tall.jpg 에서 바닥(나뭇결)이 시작되는 y 를 열마다 훑어 최소자승으로 피팅한 값이다(2026-09-18).
 * 왼쪽 벽 (0,371)→코너 (164,286)→오른쪽 벽 (327,371), 아래는 화면 끝. 바닥을 다시 만들면 같이 갱신한다.
 * 이 그림은 코너가 정중앙이라 좌우가 대칭이다(옛 그림은 코너가 왼쪽 41%).
 */
export const FLOOR_POLYGON: ScenePolygon = [
  { x: 0, y: 371 },
  { x: 164, y: 286 },
  { x: 327, y: 371 },
  { x: 327, y: 586 },
  { x: 0, y: 586 },
];

/**
 * 배치 격자를 얹는 세 면. 벽·바닥 경계선은 floor-tall.jpg 를 픽셀로 재서 얻었다(2026-09-18).
 *   좌측 벽선 y = -0.518x + 371 · 우측 벽선 y = 0.518x + 201 · 교점 (164, 286). 좌우 대칭이라 기울기 크기가 같다.
 *
 * 세 면 모두 평행사변형이다. 걸레받이선 표본이 직선으로 떨어져(64px 마다 같은 간격) 이 그림에도 원근이 사실상 없다.
 * 사영변환으로 원근을 넣으면 칸 크기가 제각각이 되어 그림과 어긋난다.
 *
 * 칸 크기는 옛 방과 같게 유지했다(col 은 x 로 48.25, row 는 x 로 -44.875) — 가구 스프라이트 크기가 이 값 기준이라
 * 바꾸면 가구가 전부 어긋난다. 대신 바닥이 깊어진 만큼 칸 수를 8×8 → 12×12 로 늘렸다.
 * 바닥 격자는 보이는 바닥 전체를 덮도록 화면 밖까지 뻗는다. 화면 밖 칸에 놓이지 않게 막는 것은 isPlaceableOnFloor 가 한다.
 */
export const SURFACES: Record<Surface, SurfaceDef> = {
  // col 은 오른쪽 벽 방향, row 는 왼쪽 벽 방향. 둘 다 화면 앞쪽으로 증가한다.
  FLOOR: {
    quad: [
      { x: 164, y: 286 },
      { x: 743, y: 586 },
      { x: 204, y: 865 },
      { x: -375, y: 565 },
    ],
    cols: 12,
    rows: 12,
  },
  // 벽은 걸레받이를 따라가는 방향이 col, 수직이 row 다. 벽면은 수직이라 행 경계는 화면에서도 수평이다.
  // 벽걸이 아이템이 1×1 칸(폭 44)이라 칸이 그보다 커야 한다. 코너가 가운데라 좌우 벽 폭이 164·163 으로 같아 둘 다 3열이다.
  // 줄 없는 바닥 그림은 벽이 더 높아(코너 y 286) 4행까지 들어간다 — 칸 약 54×71. 윗변(코너 쪽 y 2)은 화면 안에 남는 최대치다.
  WALL_LEFT: {
    quad: [
      { x: 0, y: 87 },
      { x: 164, y: 2 },
      { x: 164, y: 286 },
      { x: 0, y: 371 },
    ],
    cols: 3,
    rows: 4,
  },
  WALL_RIGHT: {
    quad: [
      { x: 164, y: 2 },
      { x: 327, y: 87 },
      { x: 327, y: 371 },
      { x: 164, y: 286 },
    ],
    cols: 3,
    rows: 4,
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
 * 구도는 그대로다(왼쪽 벽 화분, 오른쪽 뒷벽에 책상·냉장고, 가운데 소파). 2026-09-18 세로 긴 방으로 바꾸면서 칸을 다시 골랐다 — 옛 칸은 새 격자에서 화면 밖이거나 바닥을 벗어났다.
 * 테이블은 상점에서 산 가구를 골라 배치하는 흐름으로 옮기기로 해 기본 배치에서 뺐다(2026-09-09).
 * 서버(GET /room/layout)가 생기면 이 배열이 목 데이터의 placements 가 된다.
 */
export const DEFAULT_CELLS: readonly { itemId: FurnitureId; cell: GridCell }[] = [
  { itemId: "desk", cell: { col: 2, row: 0 } },
  { itemId: "fridge", cell: { col: 0, row: 2 } },
  { itemId: "plant", cell: { col: 2, row: 6 } },
  { itemId: "sofa", cell: { col: 6, row: 4 } },
];

/**
 * 벽에 실제로 붙일 수 있는 자리인지. 스프라이트 칸의 네 꼭짓점이 모두 씬 안에 들어와야 한다.
 * 새 방(2026-09-18)은 벽 윗변을 화면 안(코너 쪽 y 10)에 두어 아홉 칸이 모두 쓸 수 있다 — 옛 방은 윗줄이 화면 밖이었다.
 * 아랫변은 걸레받이선이라 격자가 이미 막는다.
 */
export function isPlaceableOnWall(surface: WallSurface, cell: GridCell, footprint: GridFootprint): boolean {
  const def = SURFACES[surface];
  if (!fitsOnSurface(def, cell, footprint)) return false;
  return cellCorners(def, cell, footprint).every(
    (corner) => corner.x >= 0 && corner.x <= SCENE_WIDTH && corner.y >= 0 && corner.y <= SCENE_HEIGHT
  );
}

/**
 * 벽 오브젝트 기본 자리(반 칸 단위). 둘 다 오른쪽 벽 가운데 줄에 나란히 — 보드는 코너 쪽 둘째 칸, 캘린더는 그 옆.
 * 오른쪽 끝 칸은 기본 배치의 냉장고에 아랫부분이 가려져 비워 둔다(웹 확인 2026-09-15).
 * 오른쪽 벽 맨 윗줄은 코너 쪽 꼭짓점이 화면 위로 나가(y -63) 놓을 수 없다.
 */
export const DEFAULT_WALL_CELLS: readonly { itemId: WallItemId; cell: GridCell }[] = [
  { itemId: "board", cell: { col: 2, row: 4 } },
  { itemId: "calendar", cell: { col: 4, row: 4 } },
];

export const DEFAULT_LAYOUT: readonly Placement[] = [
  ...DEFAULT_CELLS.map(
    ({ itemId, cell }): Placement => ({
      itemId,
      anchor: cellAnchor(SURFACES.FLOOR, cell, FURNITURE[itemId].grid),
    })
  ),
  ...DEFAULT_WALL_CELLS.map(({ itemId, cell }): Placement => {
    const item = WALL_ITEMS[itemId];
    return { itemId, surface: item.surface, anchor: cellAnchor(SURFACES[item.surface], cell, item.grid) };
  }),
];

/** 기준점이 칸 자리에서 이만큼(씬 단위) 안쪽이면 제자리로 본다. 서버가 좌표를 소수 3자리로 다듬어 생기는 차이를 흡수한다. */
const SETTLED_TOLERANCE = 0.01;

function isPlaceableOn(surface: Surface, cell: GridCell, footprint: GridFootprint): boolean {
  return surface === "FLOOR" ? isPlaceableOnFloor(cell, footprint) : isPlaceableOnWall(surface, cell, footprint);
}

/** 그 면에서 놓을 수 있는 모든 칸을 기준점에 가까운 순으로 */
function placeableCellsByDistance(surface: Surface, anchor: ScenePoint, footprint: GridFootprint): { cell: GridCell; drift: number }[] {
  const def = SURFACES[surface];
  const cells: { cell: GridCell; drift: number }[] = [];
  for (let col = 0; col + footprint.w <= def.cols * HALF_PER_CELL; col++) {
    for (let row = 0; row + footprint.d <= def.rows * HALF_PER_CELL; row++) {
      const cell = { col, row };
      if (!isPlaceableOn(surface, cell, footprint)) continue;
      cells.push({ cell, drift: distance(anchor, cellAnchor(def, cell, footprint)) });
    }
  }
  return cells.sort((a, b) => a.drift - b.drift);
}

/**
 * 서버에서 받은 배치를 지금 방의 칸에 앉힌다. 서버는 좌표만 저장하므로 옛 방(327×404, 2026-09-18 이전) 기준으로 저장된 가구는
 * 새 방에서 벽 높이에 떠 보인다 — 놓을 수 없는 자리의 가구를 가장 가까운 빈 칸으로 당긴다.
 * 이미 제자리인 것이 자리를 지키도록 덜 어긋난 것부터 앉히고, 돌려주는 순서는 입력과 같다. 앉힐 칸이 없으면 받은 그대로 둔다.
 */
export function settlePlacements(placements: readonly Placement[]): Placement[] {
  const candidates = placements.map((placement) => {
    const surface = placement.surface ?? "FLOOR";
    const footprint = roomItem(placement.itemId).grid;
    return { surface, footprint, cells: placeableCellsByDistance(surface, placement.anchor, footprint) };
  });
  const order = candidates
    .map((candidate, index) => ({ index, drift: candidate.cells[0]?.drift ?? Infinity }))
    .sort((a, b) => a.drift - b.drift || a.index - b.index);

  const taken: { surface: Surface; cell: GridCell; footprint: GridFootprint }[] = [];
  const settled = placements.map((placement) => ({ ...placement }));
  for (const { index } of order) {
    const { surface, footprint, cells } = candidates[index];
    const free = cells.find(({ cell }) => !taken.some((other) => other.surface === surface && cellsOverlap(cell, footprint, other.cell, other.footprint)));
    if (!free) continue;
    taken.push({ surface, cell: free.cell, footprint });
    if (free.drift > SETTLED_TOLERANCE) settled[index].anchor = cellAnchor(SURFACES[surface], free.cell, footprint);
  }
  return settled;
}

/**
 * 서버 배치에 없는 벽 오브젝트(보드·캘린더)를 기본 자리에 채운다 (사용자 결정 2026-09-20).
 * 둘은 예산 시트·결제 캘린더로 들어가는 입구라 서버 보유 여부와 무관하게 홈에 있어야 한다.
 * 기본 자리를 서버의 다른 벽 오브젝트가 차지하고 있으면 가장 가까운 빈 칸으로 비킨다. 채운 것은 userFurnitureId 가 없어 저장 대상에서 빠진다.
 */
export function withDefaultWallItems(placements: readonly Placement[]): Placement[] {
  const missing = DEFAULT_LAYOUT.filter((fallback) => isWallItemId(fallback.itemId) && !placements.some((p) => p.itemId === fallback.itemId));
  if (missing.length === 0) return placements.map((placement) => ({ ...placement }));
  return settlePlacements([...placements, ...missing]);
}

/** 배치가 바닥 가구인지(벽 오브젝트가 아닌지). 깊이 정렬·캐릭터 경로 계산은 이것만 본다 */
export function isFloorPlacement(placement: Placement): placement is Placement & { itemId: FurnitureId } {
  return !isWallItemId(placement.itemId);
}

/**
 * 벽 오브젝트가 지금 놓인 씬 사각형. RN 오버레이(숫자·칩)와 팝오버가 이 위에 붙는다.
 * 배치에 없으면 null — 그때는 오버레이도 그리지 않는다.
 */
export function getWallItemRect(placements: readonly Placement[], id: WallItemId): SceneRect | null {
  const placement = placements.find((p) => p.itemId === id);
  if (!placement) return null;
  const item = WALL_ITEMS[id];
  return getSpriteRect(placement.anchor, item.size, item.anchor);
}

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
  /** 서 있는 자리. 방 가로 정중앙이며 가구 발자국과 겹치지 않는다(2026-09-18 새 방에 맞춰 소파 앞으로 내렸다). */
  start: { x: 164, y: 505 } as ScenePoint,
  /** 씬 단위/초 */
  speed: 42,
  /** 도착 후 다음 이동까지 쉬는 시간(ms) */
  idleWaitMs: { min: 3000, max: 6000 },
  /** 이동 중 잔걸음 바운스 높이(씬 단위)와 주기(ms) */
  bob: { height: 3, periodMs: 360 },
  /** 멈춰 있을 때 호흡 스케일 폭과 주기(ms) */
  breath: { amount: 0.018, periodMs: 1700 },
} as const;
