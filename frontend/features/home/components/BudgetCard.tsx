import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { budgetHealth, type BudgetHealth, type BudgetTotal } from "@/features/budget/model";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

// Pencil home/p0 (EWfx2) BudgetCard: bg-primary · radius 20 · padding 20 · gap 16 · 진행 바 8pt.
// 봉투 7종 사용률 세로 막대(KZBd3)는 홈 P0 3단계(보드 확장)에서 붙인다. warning/over 문구와 색은 임시. (TBD)
const HEALTH_STYLE: Record<BudgetHealth, { label: string; textClassName: string; barClassName: string }> = {
  good: { label: "좋아요!", textClassName: "text-positive", barClassName: "bg-positive" },
  warning: { label: "조금만 아껴요", textClassName: "text-warning", barClassName: "bg-warning" },
  over: { label: "예산 초과", textClassName: "text-destructive", barClassName: "bg-destructive" },
};

type BudgetCardProps = {
  total: BudgetTotal;
};

function BudgetCard({ total }: BudgetCardProps) {
  const health = HEALTH_STYLE[budgetHealth(total)];
  const usedPercent = Math.min(100, Math.max(0, 100 - total.remainingRate));

  return (
    <View className="gap-4 rounded-xl bg-primary p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-h3 text-primary-foreground">이번 달 남은 예산</Text>
        <Text className={cn("text-caption", health.textClassName)}>{health.label}</Text>
      </View>
      <View className="gap-1">
        <Text className="text-display tabular-nums text-primary-foreground" maxFontSizeMultiplier={1.3}>
          {formatKRW(total.remaining)}
        </Text>
        <Text className="text-caption text-primary-foreground">
          총 예산 {formatKRW(total.confirmed)} 중 {formatKRW(total.spent)} 사용
        </Text>
      </View>
      <View
        className="h-2 w-full overflow-hidden rounded-full bg-accent"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="예산 사용률"
        accessibilityValue={{ min: 0, max: 100, now: usedPercent }}
      >
        <View className={cn("h-full rounded-full", health.barClassName)} style={{ width: `${usedPercent}%` }} />
      </View>
    </View>
  );
}

export { BudgetCard };
export type { BudgetCardProps };
