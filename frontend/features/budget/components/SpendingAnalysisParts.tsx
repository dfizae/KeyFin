import type { LucideIcon } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type AnalysisHeroProps = {
  icon: LucideIcon;
  /** 제목이 헤더 줄에 있는 화면(봉투별 B)은 생략한다 */
  title?: string;
  description: string;
};

// Pencil Hero (spending-analysis/summary kRrar · /envelopes J9WEvX): 40 accent 원형 타일 + 제목 + 설명.
function AnalysisHero({ icon, title, description }: AnalysisHeroProps) {
  return (
    <View className="gap-4">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
        <Icon as={icon} size={22} className="text-primary" />
      </View>
      <View className="gap-2">
        {title === undefined ? null : (
          <Text className="text-h1 text-foreground" accessibilityRole="header">
            {title}
          </Text>
        )}
        <Text className="text-body-sm text-card-foreground">{description}</Text>
      </View>
    </View>
  );
}

type SpendingBarRowProps = {
  name: string;
  value: string;
  /** 0~100. 가장 많이 쓴 봉투 대비 비율 */
  percent: number;
  thin?: boolean;
  /** 주면 막대가 0 에서 percent 까지 차오른다(ms 뒤 시작). 없으면 바로 채워진 채 그린다 */
  fillDelay?: number;
  /** 막대 색. 봉투 행이면 `envelopeTone(id).bar`, 기본은 primary */
  barClassName?: string;
};

// 이름·금액 한 줄 + 막대. 요약(A)은 굵은 막대, 봉투별(B)은 7줄이라 얇은 막대를 쓴다.
function SpendingBarRow({ name, value, percent, thin = false, fillDelay, barClassName = "bg-primary" }: SpendingBarRowProps) {
  return (
    <View className={thin ? "gap-1.5" : "gap-2"} accessible accessibilityLabel={`${name} ${value}`}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-label text-foreground" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-body-sm tabular-nums text-card-foreground">{value}</Text>
      </View>
      <View className={cn("w-full overflow-hidden rounded-full bg-muted", thin ? "h-1.5" : "h-2")}>
        {fillDelay === undefined ? (
          <View className={cn("h-full rounded-full", barClassName)} style={{ width: `${percent}%` }} />
        ) : (
          <FillingBar percent={percent} delay={fillDelay} barClassName={barClassName} />
        )}
      </View>
    </View>
  );
}

const FILL_MS = 900;
/** Animated.View 는 NativeWind className 대상이 아니라 style 로 높이를 채운다 */
const FULL_HEIGHT = { height: "100%" } as const;

// 트랙 폭을 재서 0 → percent 만큼 px 로 차오른다. 동작 줄이기 설정이면 처음부터 채워 둔다.
function FillingBar({ percent, delay, barClassName }: { percent: number; delay: number; barClassName: string }) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  React.useEffect(() => {
    if (reducedMotion || trackWidth === 0) return;
    progress.value = withDelay(delay, withTiming(1, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion, trackWidth, delay]);

  const fill = useAnimatedStyle(() => ({ width: (trackWidth * percent * progress.value) / 100 }));

  return (
    <View className="h-full w-full" onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={[FULL_HEIGHT, fill]}>
        <View className={cn("h-full rounded-full", barClassName)} />
      </Animated.View>
    </View>
  );
}

export { AnalysisHero, SpendingBarRow };
