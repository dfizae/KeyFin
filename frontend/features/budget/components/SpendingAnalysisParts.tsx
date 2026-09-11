import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type AnalysisHeroProps = {
  icon: LucideIcon;
  title: string;
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
        <Text className="text-h1 text-foreground" accessibilityRole="header">
          {title}
        </Text>
        <Text className="text-body-sm text-muted-foreground">{description}</Text>
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
};

// 이름·금액 한 줄 + 막대. 요약(A)은 굵은 막대, 봉투별(B)은 7줄이라 얇은 막대를 쓴다.
function SpendingBarRow({ name, value, percent, thin = false }: SpendingBarRowProps) {
  return (
    <View className={thin ? "gap-1.5" : "gap-2"} accessible accessibilityLabel={`${name} ${value}`}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-label text-foreground" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-body-sm tabular-nums text-muted-foreground">{value}</Text>
      </View>
      <View className={cn("w-full overflow-hidden rounded-full bg-muted", thin ? "h-1.5" : "h-2")}>
        <View className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}

export { AnalysisHero, SpendingBarRow };
