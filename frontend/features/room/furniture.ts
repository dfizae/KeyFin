import { isWallItemId, roomItem, roomItemIdByAssetKey, type RoomItemId } from "@/features/room/catalog";
import { SCENE_HEIGHT, SCENE_WIDTH, type PlacedFurnitureDto, type Surface } from "@/features/room/model";
import { settlePlacements, type Placement } from "@/features/room/scene";

/**
 * 가구 배치의 서버 계약 ↔ 씬 배치 변환 (docs/api-contract.md GAME, 방 3단계).
 *
 * 이 변환이 model.ts 가 아니라 여기 있는 이유: assetKey 로 카탈로그를 찾아야 하는데 catalog.ts 가 model.ts 를 가져다 쓴다.
 * 서버는 좌표만 저장하고 **겹침·격자·면 내부 판정은 클라이언트 몫**이다(Swagger 설명, 2026-09-16) — 그 판정은 scene.ts·grid.ts 가 그대로 한다.
 */

export const PLACEMENT_STATUSES = ["FLOOR", "LEFT_WALL", "RIGHT_WALL"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

/** 설치 방향. 지금 스프라이트는 한 방향뿐이라 보낼 때는 FRONT_RIGHT 고정이고 받은 값은 쓰지 않는다 (TBD: 좌우 반전 에셋) */
export const PLACEMENT_DIRECTIONS = ["FRONT_LEFT", "FRONT_RIGHT"] as const;
export type PlacementDirection = (typeof PLACEMENT_DIRECTIONS)[number];
const DEFAULT_DIRECTION: PlacementDirection = "FRONT_RIGHT";

/** GET /furnitures 항목 — 보유 가구 + 배치 상태. 미설치면 배치 필드가 null 이고 layer 는 0 */
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
};

export type UserFurniture = {
  userFurnitureId: number;
  /** 카탈로그에 없는 assetKey 면 null — 스프라이트가 없어 그릴 수 없다 */
  itemId: RoomItemId | null;
  name: string;
  assetKey: string;
  placed: boolean;
  placement: Placement | null;
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
  if (isWallItemId(itemId) !== (surface !== "FLOOR")) return null;
  if (!Number.isFinite(dto.positionX) || !Number.isFinite(dto.positionY)) return null;
  if (dto.positionX < 0 || dto.positionX > SCENE_WIDTH || dto.positionY < 0 || dto.positionY > SCENE_HEIGHT) return null;

  return {
    itemId,
    userFurnitureId: dto.userFurnitureId,
    anchor: { x: dto.positionX, y: dto.positionY },
    layer: dto.layer,
    ...(surface === "FLOOR" ? {} : { surface }),
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
        })
      : null;

  return { userFurnitureId: dto.userFurnitureId, itemId, name: dto.name, assetKey: dto.assetKey, placed: dto.placed, placement: placed };
}

export function toUserFurnitures(dtos: readonly UserFurnitureDto[]): UserFurniture[] {
  return dtos.map(toUserFurniture);
}

export function toPlacementRequest(placement: Placement): FurniturePlacementRequest {
  const item = roomItem(placement.itemId);
  return {
    placed: true,
    placementStatus: statusOfSurface(placement.surface),
    placementDirection: DEFAULT_DIRECTION,
    positionX: toServerCoord(placement.anchor.x, SCENE_WIDTH),
    positionY: toServerCoord(placement.anchor.y, SCENE_HEIGHT),
    layer: placement.layer ?? ("layer" in item ? (item.layer ?? 0) : 0),
  };
}

export type PlacementSave = { userFurnitureId: number; request: FurniturePlacementRequest };

/**
 * 편집 완료 시 보낼 것만 고른다 (PATCH 는 가구 한 개씩이고 일괄 엔드포인트가 없다).
 * - 자리가 그대로면 보내지 않는다.
 * - `userFurnitureId` 가 없는 배치는 서버에 대응하는 보유 가구가 없는 기본 배치라 건너뛴다.
 *   (아이템 시드가 들어오기 전까지 방을 비워 두지 않으려고 쓰는 폴백이다 — 사용자 결정 2026-09-16)
 */
export function changedPlacements(before: readonly Placement[], after: readonly Placement[]): PlacementSave[] {
  const previous = new Map(before.map((placement) => [placement.itemId, placement] as const));
  const saves: PlacementSave[] = [];

  for (const placement of after) {
    if (placement.userFurnitureId === undefined) continue;
    const old = previous.get(placement.itemId);
    if (old && samePlacement(old, placement)) continue;
    saves.push({ userFurnitureId: placement.userFurnitureId, request: toPlacementRequest(placement) });
  }
  return saves;
}

function samePlacement(left: Placement, right: Placement): boolean {
  const leftRequest = toPlacementRequest(left);
  const rightRequest = toPlacementRequest(right);
  return JSON.stringify(leftRequest) === JSON.stringify(rightRequest);
}
