import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { EnvelopeChart } from "@/features/budget/components/EnvelopeChart";
import { budgetHealth, usedBarPercent, type BudgetEnvelope, type BudgetHealth, type BudgetTotal } from "@/features/budget/model";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

// Pencil home/p0 (EWfx2) BudgetCard (sMRC0): bg-primary · radius 20 · padding 20 · gap 16 · 진행 바 8pt · 봉투 7종 사용률 세로 막대.
// good 문구 "좋아요!" 는 Pencil, warning/over 문구는 임시. (TBD)
const HEALTH_STYLE: Record<BudgetHealth, { label: string; textClassName: string; barClassName: string }> = {
  good: { label: "좋아요!", textClassName: "text-positive", barClassName: "bg-positive" },
  warning: { label: "조금만 아껴요", textClassName: "text-warning", barClassName: "bg-warning" },
  over: { label: "예산 초과", textClassName: "text-destructive", barClassName: "bg-destructive" },
};

type BudgetCardProps = {
  total: BudgetTotal;
  envelopes: BudgetEnvelope[];
  /** 현재 주기 "9월 1일~30일". 주기가 달력 월과 다를 수 있어 "이번 달" 대신 기간을 쓴다 */
  period: string;
};

function BudgetCard({ total, envelopes, period }: BudgetCardProps) {
  const health = HEALTH_STYLE[budgetHealth(total)];
  const usedPercent = usedBarPercent(total.remainingRate);

  return (
    <View className="gap-4 rounded-xl bg-primary p-5">
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text className="text-h3 text-primary-foreground">남은 예산</Text>
          <Text className="text-caption tabular-nums text-primary-foreground">{period}</Text>
        </View>
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
      <EnvelopeChart envelopes={envelopes} />
    </View>
  );
}

export { BudgetCard };
export type { BudgetCardProps };
