import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { getSceneScale } from "@/features/room/model";

// Pencil home/p0 Calendar Asset (lrclI): 오른쪽 벽 씬 단위 (242,26) 폭 64. 상단 $destructive 스트립 + 날짜 + 이름의 카드형 자리표시자이며,
// 캘린더 스프라이트가 오면 그림은 Skia 씬이 그리고 이 컴포넌트는 탭 영역과 숫자만 남는다. 부족 점은 Calendar ShortageDot (Fycy2).
export const CALENDAR_SCENE_RECT = { x: 242, y: 26, width: 64 } as const;
export const CALENDAR_DOT_SCENE_RECT = { x: 298, y: 20, size: 12 } as const;
export const CALENDAR_EMPTY_LABEL = "예정 없음";

/** 방 컴포넌트는 결제 도메인 타입에 의존하지 않는다 — 다음 출금 한 건만 받는다 */
export type UpcomingPayment = {
  /** 날짜의 일(1~31) */
  day: number;
  name: string;
  hasShortage: boolean;
};

type CalendarAssetProps = {
  /** 캔버스 폭(pt). 씬 좌표를 이 폭으로 환산한다 */
  width: number;
  /** "9월" */
  monthLabel: string;
  /** 이번 달 출금 예정이 없으면 null */
  upcoming: UpcomingPayment | null;
  onPress: () => void;
};

function CalendarAsset({ width, monthLabel, upcoming, onPress }: CalendarAssetProps) {
  const scale = getSceneScale(width);
  const status = upcoming
    ? `${upcoming.day}일 ${upcoming.name}${upcoming.hasShortage ? ", 준비 부족" : ""}`
    : `출금 ${CALENDAR_EMPTY_LABEL}`;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`출금 캘린더, ${monthLabel} ${status}`}
        accessibilityHint="이번 달 출금 일정을 엽니다"
        onPress={onPress}
        hitSlop={8}
        className="absolute overflow-hidden rounded-sm border-2 border-border bg-card active:opacity-80"
        style={{ left: CALENDAR_SCENE_RECT.x * scale, top: CALENDAR_SCENE_RECT.y * scale, width: CALENDAR_SCENE_RECT.width * scale }}
      >
        <View className="w-full items-center bg-destructive" accessible={false}>
          <Text className="text-caption text-destructive-foreground">{monthLabel}</Text>
        </View>
        <View className="items-center px-1 pb-1.5 pt-1" accessible={false}>
          <Text className="text-h2 tabular-nums text-foreground">{upcoming ? upcoming.day : "–"}</Text>
          <Text className="text-caption text-muted-foreground" numberOfLines={1}>
            {upcoming ? upcoming.name : CALENDAR_EMPTY_LABEL}
          </Text>
        </View>
      </Pressable>
      {upcoming?.hasShortage ? (
        <View
          accessible={false}
          className="absolute rounded-full bg-destructive"
          style={{
            left: CALENDAR_DOT_SCENE_RECT.x * scale,
            top: CALENDAR_DOT_SCENE_RECT.y * scale,
            width: CALENDAR_DOT_SCENE_RECT.size * scale,
            height: CALENDAR_DOT_SCENE_RECT.size * scale,
          }}
        />
      ) : null}
    </>
  );
}

export { CalendarAsset };
export type { CalendarAssetProps };
