import { Cat } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getSceneScale } from "@/features/room/model";
import type { Transaction } from "@/features/transaction/model";
import { formatKRW } from "@/lib/money";

// Pencil home/p0 CoachAvatar (Qxnt5) 씬 (0,254) 32pt 원형 · CoachBubble (o3byv) 씬 (40,262) 폭 236, bg-card · radius lg.
// 질문은 거래당 1회, 30초 무응답이면 말풍선만 접는다(거래는 PENDING 유지). 접힌 뒤 코치를 탭하면 다시 편다 (FR-TXN-03).
export const COACH_LABEL = "코치";
export const COACH_COLLAPSE_MS = 30_000;
export const OTHER_CATEGORY_LABEL = "다른 카테고리";
/** 질문 중인 1건 말고도 남아 있을 때만 모아서 정리(PAGE-22)로 보낸다 */
export const CLEANUP_MIN_COUNT = 2;
const AVATAR_SCENE = { x: 0, y: 254, size: 32 } as const;
const BUBBLE_SCENE = { x: 40, y: 262, width: 236 } as const;

type CoachBubbleProps = {
  /** 캔버스 폭(pt) */
  width: number;
  /** 질문할 미확정 거래. 없으면 코치만 보인다 */
  transaction: Transaction | null;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onOther: () => void;
  /** 남은 미확정 건수. CLEANUP_MIN_COUNT 이상이면 미확정 정리(PAGE-22) 링크를 함께 보여준다 */
  pendingCount?: number;
  onCleanup?: () => void;
};

export function coachQuestion(transaction: Transaction): string {
  return `『${transaction.merchantName} ${formatKRW(transaction.amount)}』 ${transaction.subcategoryName} 맞나냥?`;
}

function CoachBubble({ width, transaction, isPending, errorMessage, onConfirm, onOther, pendingCount = 0, onCleanup }: CoachBubbleProps) {
  const scale = getSceneScale(width);
  const [collapsedId, setCollapsedId] = React.useState<number | null>(null);
  const transactionId = transaction?.id ?? null;

  React.useEffect(() => {
    if (transactionId === null) return;
    const timer = setTimeout(() => setCollapsedId(transactionId), COACH_COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [transactionId]);

  const hasQuestion = transaction !== null;
  const collapsed = hasQuestion && collapsedId === transactionId;
  const showBubble = hasQuestion && !collapsed;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasQuestion && collapsed ? `${COACH_LABEL}, 확인할 결제 있음` : COACH_LABEL}
        onPress={hasQuestion ? () => setCollapsedId(null) : undefined}
        hitSlop={8}
        className="absolute items-center justify-center rounded-full bg-accent"
        style={{
          left: AVATAR_SCENE.x * scale,
          top: AVATAR_SCENE.y * scale,
          width: AVATAR_SCENE.size * scale,
          height: AVATAR_SCENE.size * scale,
        }}
      >
        <Icon as={Cat} size={18} className="text-foreground" />
        {hasQuestion && collapsed ? <View className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-destructive" accessible={false} /> : null}
      </Pressable>
      {showBubble ? (
        <View
          className="absolute gap-2 rounded-lg border border-border bg-card p-3"
          style={{ left: BUBBLE_SCENE.x * scale, top: BUBBLE_SCENE.y * scale, width: BUBBLE_SCENE.width * scale }}
          accessibilityLiveRegion="polite"
        >
          <Text className="text-body-sm text-foreground">{coachQuestion(transaction)}</Text>
          {errorMessage ? <Text className="text-caption text-destructive">{errorMessage}</Text> : null}
          <View className="flex-row gap-2">
            <Button size="sm" className="rounded-md" onPress={onConfirm} disabled={isPending} accessibilityLabel={`${transaction.subcategoryName} 확정`}>
              <Text>{transaction.subcategoryName} 확정</Text>
            </Button>
            <Button size="sm" variant="secondary" className="rounded-md" onPress={onOther} disabled={isPending} accessibilityLabel={OTHER_CATEGORY_LABEL}>
              <Text>{OTHER_CATEGORY_LABEL}</Text>
            </Button>
          </View>
          {pendingCount >= CLEANUP_MIN_COUNT && onCleanup ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`${pendingCount}건 모아서 정리`} hitSlop={6} onPress={onCleanup}>
              <Text className="text-caption text-primary">{pendingCount}건 모아서 정리</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export { CoachBubble };
export type { CoachBubbleProps };
