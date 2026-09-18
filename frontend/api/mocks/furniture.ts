import { FURNITURE, WALL_ITEMS } from "@/features/room/catalog";
import type { FurniturePlacementRequest, UserFurnitureDto } from "@/features/room/furniture";
import type { PlacedFurnitureDto } from "@/features/room/model";
import { DEFAULT_LAYOUT } from "@/features/room/scene";

/**
 * GET /furnitures · PATCH /furnitures/{userFurnitureId} 목.
 * 서버처럼 상태를 들고 있어서 방 꾸미기에서 옮기고 나오면 그 자리가 유지된다(다른 도메인 목과 같은 방식).
 *
 * 값은 기본 배치(scene.ts DEFAULT_LAYOUT)를 그대로 옮긴 것이다 — 실제 서버에는 아직 아이템 시드가 없어
 * 빈 배열이 오고, 그때는 화면이 다시 기본 배치로 돌아간다 (사용자 결정 2026-09-16).
 * userFurnitureId 는 목 안에서만 쓰는 번호이며 201 부터 매긴다.
 */
const FIRST_ID = 201;

function seed(): UserFurnitureDto[] {
  return DEFAULT_LAYOUT.map((placement, index) => {
    const wall = placement.surface !== undefined;
    const item = wall ? WALL_ITEMS[placement.itemId as keyof typeof WALL_ITEMS] : FURNITURE[placement.itemId as keyof typeof FURNITURE];
    return {
      userFurnitureId: FIRST_ID + index,
      itemId: index + 1,
      name: item.name,
      slotType: wall ? "WALL" : "FLOOR",
      assetKey: item.assetKey,
      placed: true,
      placementStatus: placement.surface === "WALL_LEFT" ? "LEFT_WALL" : placement.surface === "WALL_RIGHT" ? "RIGHT_WALL" : "FLOOR",
      placementDirection: "FRONT_RIGHT",
      positionX: placement.anchor.x,
      positionY: placement.anchor.y,
      layer: placement.layer ?? 0,
    };
  });
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
    }));
}

/**
 * PATCH /furnitures/{userFurnitureId} — 설치·이동은 배치를 통째로 바꾸고, 해제는 배치 필드를 null 로 되돌린다.
 * 같은 요청을 반복해도 성공한다(서버도 멱등). 없는 가구는 404 PAY 아닌 GAME 오류라 호출부가 잡도록 throw 한다.
 */
export function updateFurniturePlacementMock(userFurnitureId: number, request: FurniturePlacementRequest): UserFurnitureDto {
  const list = ensure();
  const index = list.findIndex((furniture) => furniture.userFurnitureId === userFurnitureId);
  if (index === -1) throw new Error(`furniture ${userFurnitureId} not found`);

  const current = list[index];
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
