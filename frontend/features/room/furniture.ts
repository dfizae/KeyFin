import { hangsOnWall, isWallItemId, roomItemIdByAssetKey, type FurnitureId, type RoomItemId } from "@/features/room/catalog";
import {
  PLACEMENT_DIRECTIONS,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type PlacedFurnitureDto,
  type PlacementDirection,
  type Surface,
} from "@/features/room/model";
import { facingOf, settlePlacements, type Placement } from "@/features/room/scene";

/**
 * 가구 배치의 서버 계약 ↔ 씬 배치 변환 (docs/api-contract.md GAME, 방 3단계).
 *
 * 이 변환이 model.ts 가 아니라 여기 있는 이유: assetKey 로 카탈로그를 찾아야 하는데 catalog.ts 가 model.ts 를 가져다 쓴다.
 * 서버는 좌표만 저장하고 **겹침·격자·면 내부 판정은 클라이언트 몫**이다(Swagger 설명, 2026-09-16) — 그 판정은 scene.ts·grid.ts 가 그대로 한다.
 */

export const PLACEMENT_STATUSES = ["FLOOR", "LEFT_WALL", "RIGHT_WALL"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

/**
 * 설치 방향 (서버 placementDirection). 가구 그림이 방향별로 있어 받은 값대로 그리고, 방 꾸미기의 '방향 바꾸기'가 바꾼 값을 보낸다.
 * 벽에 걸린 것은 붙은 벽이 방향을 정한다(scene.ts facingOf). 모르는 값은 FRONT_RIGHT 로 흡수한다 (규칙 90).
 */
const DEFAULT_DIRECTION: PlacementDirection = "FRONT_RIGHT";

function toDirection(raw: string | null): PlacementDirection {
  return (PLACEMENT_DIRECTIONS as readonly (string | null)[]).includes(raw) ? (raw as PlacementDirection) : DEFAULT_DIRECTION;
}

/**
 * GET /furnitures 항목 — 보유 가구 + 배치 상태. 미설치면 배치 필드가 null 이고 layer 는 0.
 * 기본 가구(백엔드 V15: 냉장고·소파·TV)는 defaultFurnitureType 이 있고 canUnplace 가 false 다 — 옮길 수만 있고 치우면 409 FURNITURE_003.
 */
export type UserFurnitureDto = {
  userFurnitureId: number;
  itemId: number;
  name: string;
  slotType: string;
  assetKey: string;
  placed: boolean;
  placementStatus: string | null;
  placementDirection: string | null;
  positionX: number | null;
  positionY: number | null;
  layer: number;
  defaultFurnitureType: string | null;
  canUnplace: boolean;
};

export type UserFurniture = {
  userFurnitureId: number;
  /** 카탈로그에 없는 assetKey 면 null — 스프라이트가 없어 그릴 수 없다 */
  itemId: RoomItemId | null;
  name: string;
  assetKey: string;
  placed: boolean;
  placement: Placement | null;
  /** 방 꾸미기에서 '넣어 두기'를 할 수 있는지. 기본 가구는 false */
  canUnplace: boolean;
};

/** PATCH /furnitures/{userFurnitureId} 요청. 해제는 나머지 필드를 같이 보내면 400 이다 */
export type FurniturePlacementRequest =
  | {
      placed: true;
      placementStatus: PlacementStatus;
      placementDirection: PlacementDirection;
      positionX: number;
      positionY: number;
      layer: number;
    }
  | { placed: false };

export function surfaceOfStatus(status: string): Surface | null {
  if (status === "FLOOR") return "FLOOR";
  if (status === "LEFT_WALL") return "WALL_LEFT";
  if (status === "RIGHT_WALL") return "WALL_RIGHT";
  return null;
}

export function statusOfSurface(surface: Surface | undefined): PlacementStatus {
  if (surface === "WALL_LEFT") return "LEFT_WALL";
  if (surface === "WALL_RIGHT") return "RIGHT_WALL";
  return "FLOOR";
}

/** 서버는 소수 3자리까지 받고 씬 밖 좌표는 400 이다. 드래그 값이 경계에 닿아도 통과하도록 다듬는다 */
function toServerCoord(value: number, max: number): number {
  return Math.round(Math.min(Math.max(value, 0), max) * 1000) / 1000;
}

/**
 * 설치된 가구 한 개를 씬 배치로. 아직 카탈로그에 없는 assetKey, 모르는 면, 씬 밖 좌표는 null 로 걸러 낸다 —
 * 서버가 좌표만 검사하므로 앱이 그릴 수 있는 값인지는 여기서 본다 (규칙 90).
 */
export function toPlacement(dto: PlacedFurnitureDto): Placement | null {
  const itemId = roomItemIdByAssetKey(dto.assetKey);
  const surface = surfaceOfStatus(dto.placementStatus);
  if (itemId === undefined || surface === null) return null;
  if (hangsOnWall(itemId) !== (surface !== "FLOOR")) return null;
  if (!Number.isFinite(dto.positionX) || !Number.isFinite(dto.positionY)) return null;
  if (dto.positionX < 0 || dto.positionX > SCENE_WIDTH || dto.positionY < 0 || dto.positionY > SCENE_HEIGHT) return null;

  // 방향은 바닥 가구만 쓰고 FRONT_RIGHT 는 생략형으로 둔다(scene.ts Placement). 벽에 걸린 것은 붙은 벽이 방향을 정한다.
  const turned = surface === "FLOOR" && toDirection(dto.placementDirection) === "FRONT_LEFT";
  return {
    itemId,
    userFurnitureId: dto.userFurnitureId,
    anchor: { x: dto.positionX, y: dto.positionY },
    layer: dto.layer,
    ...(surface === "FLOOR" ? {} : { surface }),
    ...(turned ? { direction: "FRONT_LEFT" as const } : {}),
  };
}

/**
 * 설치된 가구를 그릴 수 있는 것만 씬 배치로. 빈 배열이면 화면이 기본 배치로 되돌아간다.
 * 놓을 수 없는 자리(옛 방 기준 좌표 등)에 저장된 것은 가장 가까운 빈 칸에 앉힌다 — 서버 값은 사용자가 방 꾸미기에서 옮겨 저장할 때 바뀐다.
 */
export function toPlacements(dtos: readonly PlacedFurnitureDto[]): Placement[] {
  return settlePlacements(dtos.map(toPlacement).filter((placement): placement is Placement => placement !== null));
}

export function toUserFurniture(dto: UserFurnitureDto): UserFurniture {
  const itemId = roomItemIdByAssetKey(dto.assetKey) ?? null;
  const placed =
    dto.placed && dto.placementStatus !== null && dto.positionX !== null && dto.positionY !== null
      ? toPlacement({
          userFurnitureId: dto.userFurnitureId,
          itemId: dto.itemId,
          slotType: dto.slotType,
          assetKey: dto.assetKey,
          placementStatus: dto.placementStatus,
          placementDirection: dto.placementDirection ?? DEFAULT_DIRECTION,
          positionX: dto.positionX,
          positionY: dto.positionY,
          layer: dto.layer,
          defaultFurnitureType: dto.defaultFurnitureType,
          canUnplace: dto.canUnplace,
        })
      : null;

  return {
    userFurnitureId: dto.userFurnitureId,
    itemId,
    name: dto.name,
    assetKey: dto.assetKey,
    placed: dto.placed,
    placement: placed,
    canUnplace: dto.canUnplace,
  };
}

export function toUserFurnitures(dtos: readonly UserFurnitureDto[]): UserFurniture[] {
  return dtos.map(toUserFurniture);
}

export function toPlacementRequest(placement: Placement): FurniturePlacementRequest {
  return {
    placed: true,
    placementStatus: statusOfSurface(placement.surface),
    placementDirection: facingOf(placement),
    positionX: toServerCoord(placement.anchor.x, SCENE_WIDTH),
    positionY: toServerCoord(placement.anchor.y, SCENE_HEIGHT),
    layer: placement.layer ?? 0,
  };
}

export type PlacementSave = { userFurnitureId: number; request: FurniturePlacementRequest };

/**
 * 편집 완료 시 보낼 것만 고른다 (PATCH 는 가구 한 개씩이고 일괄 엔드포인트가 없다).
 * - 넣어 둔(편집 전에는 있다가 사라진) 가구는 설치 해제(`placed: false`)를 먼저 보낸다.
 * - 새로 놓았거나 자리·방향이 바뀐 가구는 설치를 보낸다. 그대로인 것은 보내지 않는다.
 * - `userFurnitureId` 가 없는 배치는 서버에 대응하는 보유 가구가 없는 기본 배치라 건너뛴다.
 */
export function changedPlacements(before: readonly Placement[], after: readonly Placement[]): PlacementSave[] {
  const previous = new Map(before.flatMap((placement) => (placement.userFurnitureId === undefined ? [] : [[placement.userFurnitureId, placement] as const])));
  const kept = new Set(after.map((placement) => placement.userFurnitureId));
  const saves: PlacementSave[] = [];

  for (const userFurnitureId of previous.keys()) {
    if (!kept.has(userFurnitureId)) saves.push({ userFurnitureId, request: { placed: false } });
  }
  for (const placement of after) {
    if (placement.userFurnitureId === undefined) continue;
    const old = previous.get(placement.userFurnitureId);
    if (old && samePlacement(old, placement)) continue;
    saves.push({ userFurnitureId: placement.userFurnitureId, request: toPlacementRequest(placement) });
  }
  return saves;
}

/** 보관함의 가구 한 개. 그릴 수 있는 가구만 들어온다 */
export type StoredFurniture = UserFurniture & { itemId: FurnitureId };

/**
 * 방 꾸미기 보관함에 보일 가구: 보유했지만 지금 배치(편집 사본)에 없는 것. 서버 보유 가구 id 오름차순을 그대로 둔다.
 * 카탈로그에 없어 그릴 수 없는 가구와, 늘 홈에 있어야 하는 벽 기능 오브젝트(보드·캘린더)는 뺀다.
 */
export function storedFurnitures(owned: readonly UserFurniture[], placements: readonly Placement[]): StoredFurniture[] {
  const placedIds = new Set(placements.map((placement) => placement.userFurnitureId));
  const placedItems = new Set<RoomItemId>(placements.map((placement) => placement.itemId));
  return owned.filter(
    (furniture): furniture is StoredFurniture =>
      furniture.itemId !== null &&
      !isWallItemId(furniture.itemId) &&
      !placedIds.has(furniture.userFurnitureId) &&
      !placedItems.has(furniture.itemId)
  );
}

/** '넣어 두기'를 못 하는 이유. 할 수 있으면 null */
export type StoreAwayBlock = "WALL_OBJECT" | "DEFAULT_FURNITURE";

/**
 * 배치된 것을 보관함으로 넣을 수 있는지. 벽 기능 오브젝트는 홈의 입구라 넣어 두지 않고,
 * 기본 가구(서버 canUnplace=false)와 서버에 대응하는 보유 가구가 없는 기본 배치는 서버가 해제를 받지 않는다.
 * 보유 목록을 아직 못 받았으면 기본 가구인지 알 수 없어 막는다.
 */
export function storeAwayBlock(placement: Placement, owned: readonly UserFurniture[] | undefined): StoreAwayBlock | null {
  if (isWallItemId(placement.itemId)) return "WALL_OBJECT";
  const furniture = owned?.find((candidate) => candidate.userFurnitureId === placement.userFurnitureId);
  return furniture?.canUnplace ? null : "DEFAULT_FURNITURE";
}

function samePlacement(left: Placement, right: Placement): boolean {
  const leftRequest = toPlacementRequest(left);
  const rightRequest = toPlacementRequest(right);
  return JSON.stringify(leftRequest) === JSON.stringify(rightRequest);
}
