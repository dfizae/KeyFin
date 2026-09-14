import { Pin } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getSceneScale } from "@/features/room/model";
import { cn } from "@/lib/utils";

// Pencil home/p0 WallBoard Asset (K5Ndp): 왼쪽 벽 창문 옆, 씬 단위 (20,22) 폭 88. 카드형 자리표시자이며 벽 보드 스프라이트가 오면
// 그림은 Skia 씬이 그리고 이 컴포넌트는 탭 영역과 숫자·칩만 남긴다 (사용자 결정 2026-09-08).
export const WALL_BOARD_SCENE_RECT = { x: 20, y: 22, width: 88 } as const;

/** 칩 색. 예산 도메인의 EnvelopeHealth 와 값이 같지만 방 컴포넌트는 예산 타입에 의존하지 않는다. */
export type BoardTone = "good" | "warning" | "over" | "unset";

const TONE_CLASS: Record<BoardTone, string> = {
  good: "bg-positive",
  warning: "bg-warning",
  over: "bg-destructive",
  unset: "bg-muted",
};

type WallBoardProps = {
  /** 캔버스 폭(pt). 씬 좌표를 이 폭으로 환산한다 */
  width: number;
  /** 보드에 적는 기간. 좁아서 "9.1~9.30" 처럼 줄인다 */
  periodLabel: string;
  /** 스크린리더가 읽는 기간 "9월 1일~30일" */
  periodAccessibilityLabel: string;
  /** 전체 잔여율(%). 승인 전이면 null */
  remainingRate: number | null;
  chips: BoardTone[];
  onPress: () => void;
};

function WallBoard({ width, periodLabel, periodAccessibilityLabel, remainingRate, chips, onPress }: WallBoardProps) {
  const scale = getSceneScale(width);
  const status = remainingRate === null ? "예산 미설정" : `${remainingRate}% 남음`;
  const fillPercent = remainingRate === null ? 0 : Math.min(100, Math.max(0, remainingRate));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`예산 보드, ${periodAccessibilityLabel} ${status}`}
      accessibilityHint="봉투별 잔액을 엽니다"
      onPress={onPress}
      hitSlop={8}
      className="absolute gap-1 rounded-sm border-2 border-border bg-card px-2.5 py-2 active:opacity-80"
      style={{ left: WALL_BOARD_SCENE_RECT.x * scale, top: WALL_BOARD_SCENE_RECT.y * scale, width: WALL_BOARD_SCENE_RECT.width * scale }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="shrink text-caption tabular-nums text-foreground" numberOfLines={1}>
          {periodLabel}
        </Text>
        <Icon as={Pin} size={10} className="text-card-foreground" />
      </View>
      <Text className={cn("text-label tabular-nums", remainingRate === null ? "text-card-foreground" : "text-primary")}>{status}</Text>
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted" accessible={false}>
        {remainingRate !== null ? <View className="h-full rounded-full bg-positive" style={{ width: `${fillPercent}%` }} /> : null}
      </View>
      <View className="flex-row gap-0.5" accessible={false}>
        {chips.map((tone, index) => (
          <View key={index} className={cn("h-1 w-2 rounded-full", TONE_CLASS[tone])} />
        ))}
      </View>
    </Pressable>
  );
}

export { WallBoard };
export type { WallBoardProps };
