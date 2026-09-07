import { View } from "react-native";

import { Text } from "@/components/ui/text";
import type { BudgetStatus, MonthlyBudget } from "@/features/home/model";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

// Pencil 홈(캐릭터 활성화) BudgetCard (oIAhy): bg-primary · radius 20 · padding 20 · gap 16 · 진행 바 8pt.
// Pencil 에는 "좋아요!" 상태만 그려져 있다. warning/over 문구와 색은 임시. (TBD)
const STATUS_STYLE: Record<BudgetStatus, { label: string; textClassName: string; barClassName: string }> = {
  good: { label: "좋아요!", textClassName: "text-positive", barClassName: "bg-positive" },
  warning: { label: "조금만 아껴요", textClassName: "text-warning", barClassName: "bg-warning" },
  over: { label: "예산 초과", textClassName: "text-destructive", barClassName: "bg-destructive" },
};

type BudgetCardProps = {
  budget: MonthlyBudget;
};

function BudgetCard({ budget }: BudgetCardProps) {
  const status = STATUS_STYLE[budget.status];
  const remaining = formatKRW(budget.remaining);
  const percent = Math.round(budget.usedRatio * 100);

  return (
    <View className="gap-4 rounded-xl bg-primary p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-h3 text-primary-foreground">이번 달 남은 예산</Text>
        <Text className={cn("text-caption", status.textClassName)}>{status.label}</Text>
      </View>
      <View className="gap-1">
        <Text className="text-display tabular-nums text-primary-foreground" maxFontSizeMultiplier={1.3}>
          {remaining}
        </Text>
        <Text className="text-caption text-primary-foreground">
          총 예산 {formatKRW(budget.total)} 중 {formatKRW(budget.spent)} 사용
        </Text>
      </View>
      <View
        className="h-2 w-full overflow-hidden rounded-full bg-accent"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="예산 사용률"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View className={cn("h-full rounded-full", status.barClassName)} style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}

export { BudgetCard };
export type { BudgetCardProps };
