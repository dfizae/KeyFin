import * as React from "react";

import { useAuthStore } from "@/features/auth/store";
import type { WallItemId } from "@/features/room/catalog";
import { loadRoomGuideSeen, saveRoomGuideSeen } from "@/lib/session-storage";

/**
 * 홈 첫 진입 안내 (사용자 결정 2026-09-20). 벽의 리스트·캘린더는 글자가 없는 에셋이라 눌러야 한다는 단서가 없고,
 * 리스트는 예산으로 들어가는 유일한 입구다 — 코치 말풍선이 한 번만 차례로 알려 준다.
 * 끝까지 보거나, 그만 보거나, 안내 중에 에셋을 직접 누르면 끝나고 기기에 기록해 다시 보여 주지 않는다.
 */
export const ROOM_GUIDE_STEPS: readonly { target: WallItemId; message: string }[] = [
  { target: "board", message: "벽에 걸린 리스트를 눌러 보세요. 이번 달 예산과 봉투별 남은 금액을 볼 수 있어요." },
  { target: "calendar", message: "옆의 캘린더를 누르면 이번 달 출금 예정일을 확인할 수 있어요." },
];

export type RoomGuide = {
  /** 지금 안내 중인 단계. 안내가 없으면 null */
  step: { target: WallItemId; message: string; index: number; isLast: boolean } | null;
  next: () => void;
  finish: () => void;
};

/** enabled 는 방이 그려진 뒤에 참이 된다 — 불러오는 중·오류 화면 위에는 안내를 띄우지 않는다 */
export function useRoomGuide(enabled: boolean): RoomGuide {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [index, setIndex] = React.useState<number | null>(null);
  const finished = React.useRef(false);

  // 기기 저장소(외부 시스템)에서 "봤음" 기록을 읽어 온다
  React.useEffect(() => {
    if (!enabled || userId === null) return;
    let cancelled = false;
    void loadRoomGuideSeen(userId).then((seen) => {
      if (!cancelled && !seen && !finished.current) setIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  const finish = React.useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setIndex(null);
    if (userId !== null) void saveRoomGuideSeen(userId);
  }, [userId]);

  const next = React.useCallback(() => {
    if (index === null) return;
    if (index >= ROOM_GUIDE_STEPS.length - 1) finish();
    else setIndex(index + 1);
  }, [index, finish]);

  const current = index === null ? null : ROOM_GUIDE_STEPS[index];
  return {
    step: current && index !== null ? { ...current, index, isLast: index === ROOM_GUIDE_STEPS.length - 1 } : null,
    next,
    finish,
  };
}
