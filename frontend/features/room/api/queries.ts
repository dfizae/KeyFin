import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getFurnitures, updateFurniturePlacement, type FurnitureSlotType } from "@/features/room/api/furniture.api";
import { checkAttendance, getRoom } from "@/features/room/api/room.api";
import type { PlacementSave } from "@/features/room/furniture";
import type { Room } from "@/features/room/model";
import { shopKeys } from "@/features/shop/api/queries";

export const roomKeys = {
  all: ["room"] as const,
  home: () => [...roomKeys.all, "home"] as const,
  /** 보유 가구. 배치를 저장하면 방 홈과 함께 무효화한다 */
  furnitures: (slotType?: FurnitureSlotType) => [...roomKeys.all, "furnitures", slotType ?? "all"] as const,
};

export function roomQueryOptions() {
  return queryOptions({
    queryKey: roomKeys.home(),
    queryFn: ({ signal }) => getRoom(signal),
    staleTime: 30_000,
  });
}

export function useRoom() {
  return useQuery(roomQueryOptions());
}

/**
 * 출석 결과의 잔액을 방 캐시에 바로 반영한다 (docs/api-guide.md §5). 방은 재조회하지 않는다 — 서버 잔액이 응답에 있다.
 * 코인이 실제로 지급됐으면 새 이력이 생겼으니 코인 잔액·이력(PAGE-30)은 다시 받는다.
 */
export function useCheckAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => checkAttendance(),
    onSuccess: (attendance) => {
      queryClient.setQueryData<Room>(roomKeys.home(), (old) =>
        old ? { ...old, coinBalance: attendance.balance, checkedInToday: true } : old
      );
      if (attendance.granted > 0) void queryClient.invalidateQueries({ queryKey: shopKeys.coins() });
    },
  });
}

export function furnitureListQueryOptions(slotType?: FurnitureSlotType) {
  return queryOptions({
    queryKey: roomKeys.furnitures(slotType),
    queryFn: ({ signal }) => getFurnitures(slotType, signal),
    staleTime: 30_000,
  });
}

/** 보유 가구 목록. 방 화면은 GET /room 의 furnitures 로 충분하고, 이 조회는 미설치 가구까지 볼 때 쓴다 */
export function useFurnitures(slotType?: FurnitureSlotType) {
  return useQuery(furnitureListQueryOptions(slotType));
}

/**
 * 방 꾸미기 완료 저장. 가구 한 개씩 PATCH 하는 계약이라 옮긴 것만 차례로 보낸다.
 * 중간에 실패하면 거기서 멈추고 오류를 올린다 — 이미 보낸 것은 서버에 남고, 요청이 멱등이라 다시 눌러도 안전하다.
 */
export function useSavePlacements() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (saves: PlacementSave[]) => {
      for (const save of saves) {
        await updateFurniturePlacement(save.userFurnitureId, save.request);
      }
      return saves.length;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}
