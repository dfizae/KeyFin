import { api, isMocked } from "@/api/client";
import { furnitureListMock, updateFurniturePlacementMock } from "@/api/mocks/furniture";
import { withMockLatency } from "@/api/mocks/latency";
import {
  toUserFurniture,
  toUserFurnitures,
  type FurniturePlacementRequest,
  type UserFurniture,
  type UserFurnitureDto,
} from "@/features/room/furniture";

/** 가구 종류. 방 배치는 바닥·벽 둘뿐이고 아바타 아이템은 /items 가 따로 준다 */
export type FurnitureSlotType = "FLOOR" | "WALL";

/**
 * GET /furnitures — 보유 가구와 배치 상태 (docs/api-contract.md GAME, 방 3단계).
 * 보유 가구 id 오름차순이며 미설치 가구도 함께 온다. 아직 아이템 시드가 없어 실서버에서는 빈 배열이다.
 */
export async function getFurnitures(slotType?: FurnitureSlotType, signal?: AbortSignal): Promise<UserFurniture[]> {
  if (isMocked("room")) return toUserFurnitures(await withMockLatency(furnitureListMock(slotType), signal));
  const { data } = await api.get<UserFurnitureDto[]>("/furnitures", { params: { slotType }, signal });
  return toUserFurnitures(data);
}

/**
 * PATCH /furnitures/{userFurnitureId} — 가구 한 개의 배치를 바꾼다. 일괄 엔드포인트가 없어 옮긴 가구마다 부른다.
 * 같은 요청을 반복해도 성공한다(멱등). 없거나 남의 가구는 404 다.
 */
export async function updateFurniturePlacement(
  userFurnitureId: number,
  request: FurniturePlacementRequest
): Promise<UserFurniture> {
  if (isMocked("room")) return toUserFurniture(await withMockLatency(updateFurniturePlacementMock(userFurnitureId, request)));
  const { data } = await api.patch<UserFurnitureDto>(`/furnitures/${userFurnitureId}`, request);
  return toUserFurniture(data);
}
