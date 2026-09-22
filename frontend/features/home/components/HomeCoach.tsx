import { useRouter } from "expo-router";

import { CoachTarget } from "@/features/home/components/CoachTarget";
import { flattenPending, usePendingTransactions } from "@/features/transaction/api/queries";

/** 코치 고양이를 누르면 여는 코칭 대화 화면 (PAGE-31) */
export const COACHING_CHAT_ROUTE = "/coaching/chat";

type HomeCoachTargetProps = {
  /** 캔버스 폭(pt) */
  width: number;
  /** 눌러서 이동하기 직전에 부른다(첫 진입 안내를 끝내는 데 쓴다) */
  onOpen?: () => void;
};

/**
 * 방의 코치(고양이) 탭 영역. 누르면 코칭 대화 화면으로 간다(2026-09-22 사용자 요청 — 2026-09-15 의 임시 "?" 말풍선을 대신한다).
 * 미확정 결제가 있으면 귀 옆에 점을 달아 정리할 것이 있음을 알린다. 정리 링크 자체는 대화 화면 상단에 있다.
 * 미확정 조회 실패는 점만 빼고 조용히 넘긴다 — 홈의 다른 영역을 막지 않는다.
 */
function HomeCoachTarget({ width, onOpen }: HomeCoachTargetProps) {
  const router = useRouter();
  const pending = usePendingTransactions();
  const open = () => {
    onOpen?.();
    router.push(COACHING_CHAT_ROUTE);
  };
  return <CoachTarget width={width} hasPending={flattenPending(pending.data).length > 0} onPress={open} />;
}

export { HomeCoachTarget };
export type { HomeCoachTargetProps };
