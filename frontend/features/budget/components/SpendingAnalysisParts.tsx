import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { FillBar } from "@/components/ui/fill-bar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

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
function SpendingBarRow({ name, value, percent, thin = false, fillDelay, barClassName }: SpendingBarRowProps) {
  return (
    <View className={thin ? "gap-1.5" : "gap-2"} accessible accessibilityLabel={`${name} ${value}`}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-label text-foreground" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-body-sm tabular-nums text-card-foreground">{value}</Text>
      </View>
      <FillBar percent={percent} fillClassName={barClassName} className={thin ? "h-1.5" : "h-2"} fillDelay={fillDelay} />
    </View>
  );
}

export { AnalysisHero, SpendingBarRow };
