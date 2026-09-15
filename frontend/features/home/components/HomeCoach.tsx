import { useRouter } from "expo-router";

import { CoachBubble } from "@/features/home/components/CoachBubble";
import { usePendingTransactions } from "@/features/transaction/api/queries";

const CLEANUP_ROUTE = "/transaction/pending";

type HomeCoachProps = {
  /** 캔버스 폭(pt) */
  width: number;
};

/**
 * 방의 코치. 탭하면 임시 "?" 말풍선이 뜨고(코치봇 소통창 예정, 사용자 결정 2026-09-15), 미확정 결제가 있으면 정리 화면(PAGE-22) 링크를 함께 보여준다.
 * 거래 분류는 서버가 제안 세분류를 주지 않아 말풍선에서 하지 않고 PAGE-22 에서 한다 (FR-TXN-03).
 * 미확정 조회 실패는 코치만 두고 조용히 넘긴다 — 홈의 다른 영역을 막지 않는다. (TBD: 실패 문구)
 */
function HomeCoach({ width }: HomeCoachProps) {
  const router = useRouter();
  const pending = usePendingTransactions();

  return <CoachBubble width={width} pendingCount={pending.data?.items.length ?? 0} onCleanup={() => router.push(CLEANUP_ROUTE)} />;
}

export { HomeCoach };
export type { HomeCoachProps };
