import { Cat } from "lucide-react-native";
import * as React from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getSceneScale } from "@/features/room/model";

// Pencil home/p0 CoachAvatar (Qxnt5) 씬 (0,254) 32pt 원형 · CoachBubble (o3byv) 씬 (40,262) 폭 236, bg-card · radius lg.
// 2026-09-15 사용자 결정: 코치를 탭하면 코치봇 소통창이 열릴 예정이라, 그 전까지는 임시로 "?" 말풍선만 띄운다.
// 미확정 거래 분류 질문은 서버가 제안 세분류를 주지 않아 말풍선에서 뺐고, 미확정 정리(PAGE-22) 링크만 남긴다.
export const COACH_LABEL = "코치";
export const COACH_PLACEHOLDER = "?";
/** 코치 아바타의 씬 자리. 첫 진입 안내가 코치를 가리킬 때 이 값으로 화면 사각형을 구한다 */
export const AVATAR_SCENE = { x: 0, y: 254, size: 32 } as const;
const BUBBLE_SCENE = { x: 40, y: 262, width: 236 } as const;

type CoachBubbleProps = {
  /** 캔버스 폭(pt) */
  width: number;
  /** 미확정 결제 건수(받아 둔 첫 쪽 기준). 1건 이상이면 정리 링크를 보여준다 */
  pendingCount?: number;
  /** 서버에 더 남아 있어(다음 커서 있음) 건수가 전부가 아닐 때 */
  pendingMore?: boolean;
  onCleanup?: () => void;
  /**
   * 말풍선·코치를 오른쪽으로 미는 거리(pt). 홈은 방이 화면보다 넓어(cover 맞춤) 씬 x 0 이 화면 밖이므로,
   * 넘친 절반만큼 밀어 화면 왼쪽 끝에 맞춘다. 패널 레이어는 카메라를 따라가지 않아 고정값이면 된다.
   */
  offsetX?: number;
};

export function cleanupLinkLabel(pendingCount: number, pendingMore = false): string {
  return `미확정 결제 ${pendingCount}건${pendingMore ? "+" : ""} 정리`;
}

function CoachBubble({ width, pendingCount = 0, pendingMore = false, onCleanup, offsetX = 0 }: CoachBubbleProps) {
  const scale = getSceneScale(width);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={COACH_LABEL}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        hitSlop={8}
        className="absolute items-center justify-center rounded-full bg-accent"
        style={{
          left: AVATAR_SCENE.x * scale + offsetX,
          top: AVATAR_SCENE.y * scale,
          width: AVATAR_SCENE.size * scale,
          height: AVATAR_SCENE.size * scale,
        }}
      >
        <Icon as={Cat} size={18} className="text-foreground" />
        {pendingCount > 0 ? <View className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-destructive" accessible={false} /> : null}
      </Pressable>
      {open ? (
        <View
          className="absolute gap-2 rounded-lg border border-border bg-card p-3"
          style={{ left: BUBBLE_SCENE.x * scale + offsetX, top: BUBBLE_SCENE.y * scale, width: BUBBLE_SCENE.width * scale }}
          accessibilityLiveRegion="polite"
        >
          <Text className="text-body-sm text-foreground">{COACH_PLACEHOLDER}</Text>
          {pendingCount > 0 && onCleanup ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={cleanupLinkLabel(pendingCount, pendingMore)}
              hitSlop={6}
              onPress={onCleanup}
            >
              <Text className="text-caption text-primary">{cleanupLinkLabel(pendingCount, pendingMore)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export { CoachBubble };
export type { CoachBubbleProps };
