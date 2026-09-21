import { FURNITURE, WALL_ITEMS, isWallItemId, type FurnitureId } from "@/features/room/catalog";
import { statusOfSurface, toPlacementRequest, type FurniturePlacementRequest, type UserFurnitureDto } from "@/features/room/furniture";
import type { PlacedFurnitureDto } from "@/features/room/model";
import { DEFAULT_LAYOUT } from "@/features/room/scene";

/**
 * GET /furnitures · PATCH /furnitures/{userFurnitureId} 목.
 * 서버처럼 상태를 들고 있어서 방 꾸미기에서 옮기고 나오면 그 자리가 유지된다(다른 도메인 목과 같은 방식).
 *
 * 시작 상태는 기본 배치(scene.ts DEFAULT_LAYOUT) — 서버 기본 가구(백엔드 V15: 냉장고·소파·TV, 치울 수 없음)와 벽 보드·캘린더다.
 * 여기에 보관함을 볼 수 있게 산 뒤 아직 안 놓은 가구 몇 개를 더 둔다(상점 목도 이것을 '보유 중'으로 보여 준다).
 * 상점 목에서 가구를 사면 acquireFurnitureMock 이 미설치 상태로 더한다. userFurnitureId 는 목 안에서만 쓰는 번호다.
 */
const FIRST_ID = 201;

/** 서버 DefaultFurnitureType. 앱은 값을 쓰지 않고 canUnplace 로만 판단한다 */
const DEFAULT_FURNITURE_TYPES: Partial<Record<FurnitureId, string>> = {
  fridge_default: "FRIDGE",
  sofa_default: "SOFA",
  tv_default: "TV",
};

/** 산 뒤 보관함에 있는 가구(목 시작 상태). 바닥 가구·벽 장식·러그를 하나씩 넣어 꺼내 놓는 흐름을 모두 볼 수 있게 했다 */
export const MOCK_STORED_FURNITURE: readonly FurnitureId[] = ["bed_pink", "decor_checker_rug", "window_sky_clouds", "plant_monstera_terracotta"];

function seed(): UserFurnitureDto[] {
  const placed = DEFAULT_LAYOUT.map((placement, index): UserFurnitureDto => {
    const item = isWallItemId(placement.itemId) ? WALL_ITEMS[placement.itemId] : FURNITURE[placement.itemId];
    const request = toPlacementRequest(placement);
    const defaultType = isWallItemId(placement.itemId) ? undefined : DEFAULT_FURNITURE_TYPES[placement.itemId];
    return {
      userFurnitureId: FIRST_ID + index,
      itemId: index + 1,
      name: item.name,
      slotType: placement.surface === undefined ? "FLOOR" : "WALL",
      assetKey: item.assetKey,
      placed: true,
      placementStatus: statusOfSurface(placement.surface),
      placementDirection: request.placed ? request.placementDirection : null,
      positionX: placement.anchor.x,
      positionY: placement.anchor.y,
      layer: placement.layer ?? 0,
      defaultFurnitureType: defaultType ?? null,
      // 벽 보드·캘린더는 서버에 없는 목 전용 보유 가구다. 홈의 입구라 앱도 넣어 두지 않는다
      canUnplace: defaultType === undefined && !isWallItemId(placement.itemId),
    };
  });
  const stored = MOCK_STORED_FURNITURE.map((id, index) => unplaced(FIRST_ID + placed.length + index, 100 + index, id));
  return [...placed, ...stored];
}

function unplaced(userFurnitureId: number, itemId: number, id: FurnitureId): UserFurnitureDto {
  const item = FURNITURE[id];
  return {
    userFurnitureId,
    itemId,
    name: item.name,
    slotType: item.slot,
    assetKey: item.assetKey,
    placed: false,
    placementStatus: null,
    placementDirection: null,
    positionX: null,
    positionY: null,
    layer: 0,
    defaultFurnitureType: null,
    canUnplace: true,
  };
}

let furnitures: UserFurnitureDto[] | null = null;

function ensure(): UserFurnitureDto[] {
  if (furnitures === null) furnitures = seed();
  return furnitures;
}

/** 서버는 보유 가구 id 오름차순으로 주고, slotType 을 주면 그 종류만 준다 */
export function furnitureListMock(slotType?: string): UserFurnitureDto[] {
  return ensure()
    .filter((furniture) => slotType === undefined || furniture.slotType === slotType)
    .map((furniture) => ({ ...furniture }));
}

/** 상점 목의 '보유 중' 표시용 */
export function ownsFurnitureMock(assetKey: string): boolean {
  return ensure().some((furniture) => furniture.assetKey === assetKey);
}

/** 상점에서 산 가구를 미설치 상태로 보유한다(서버 UserFurniture.acquire). 카탈로그에 없는 키면 null */
export function acquireFurnitureMock(itemId: number, userFurnitureId: number, assetKey: string): number | null {
  if (!(assetKey in FURNITURE)) return null;
  ensure().push(unplaced(userFurnitureId, itemId, assetKey as FurnitureId));
  return userFurnitureId;
}

/** GET /room 의 furnitures — 설치된 것만, 배치 필드가 채워진 모양으로 */
export function placedFurnitureMock(): PlacedFurnitureDto[] {
  return ensure()
    .filter((furniture) => furniture.placed && furniture.placementStatus !== null)
    .map((furniture) => ({
      userFurnitureId: furniture.userFurnitureId,
      itemId: furniture.itemId,
      slotType: furniture.slotType,
      assetKey: furniture.assetKey,
      placementStatus: furniture.placementStatus as string,
      placementDirection: furniture.placementDirection ?? "FRONT_RIGHT",
      positionX: furniture.positionX as number,
      positionY: furniture.positionY as number,
      layer: furniture.layer,
      defaultFurnitureType: furniture.defaultFurnitureType,
      canUnplace: furniture.canUnplace,
    }));
}

/**
 * PATCH /furnitures/{userFurnitureId} — 설치·이동은 배치를 통째로 바꾸고, 해제는 배치 필드를 null 로 되돌린다.
 * 같은 요청을 반복해도 성공한다(서버도 멱등). 없는 가구와 기본 가구 해제는 서버처럼 오류로 던져 호출부가 잡게 한다.
 */
export function updateFurniturePlacementMock(userFurnitureId: number, request: FurniturePlacementRequest): UserFurnitureDto {
  const list = ensure();
  const index = list.findIndex((furniture) => furniture.userFurnitureId === userFurnitureId);
  if (index === -1) throw new Error(`furniture ${userFurnitureId} not found`);

  const current = list[index];
  if (!request.placed && !current.canUnplace) throw new Error(`furniture ${userFurnitureId} cannot be unplaced`);
  const updated: UserFurnitureDto = request.placed
    ? {
        ...current,
        placed: true,
        placementStatus: request.placementStatus,
        placementDirection: request.placementDirection,
        positionX: request.positionX,
        positionY: request.positionY,
        layer: request.layer,
      }
    : { ...current, placed: false, placementStatus: null, placementDirection: null, positionX: null, positionY: null, layer: 0 };

  list[index] = updated;
  return { ...updated };
}

/** 테스트·개발 재시작용 */
export function resetFurnitureMocks(): void {
  furnitures = null;
}
