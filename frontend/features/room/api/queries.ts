import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { checkAttendance, getRoom } from "@/features/room/api/room.api";
import type { Room } from "@/features/room/model";

export const roomKeys = {
  all: ["room"] as const,
  home: () => [...roomKeys.all, "home"] as const,
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

/** 출석 결과의 잔액을 방 캐시에 바로 반영한다 (docs/api-guide.md §5). 재조회는 하지 않는다 — 서버 잔액이 응답에 있다. */
export function useCheckAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => checkAttendance(),
    onSuccess: (attendance) => {
      queryClient.setQueryData<Room>(roomKeys.home(), (old) =>
        old ? { ...old, coinBalance: attendance.balance, checkedInToday: true } : old
      );
    },
  });
}
