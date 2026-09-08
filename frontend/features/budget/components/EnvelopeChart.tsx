import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { envelopeShortName } from "@/features/budget/catalog";
import { envelopeHealth, usedPercent, type BudgetEnvelope, type EnvelopeHealth } from "@/features/budget/model";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

// Pencil home/p0 EnvelopeChart (KZBd3): 봉투 7종 사용률 세로 막대. 위 퍼센트, 아래 짧은 이름. 남은 30% 미만 노랑, 초과는 빨강에 100% 로 자른다.
const FILL_CLASS: Record<EnvelopeHealth, string> = {
  good: "bg-positive",
  warning: "bg-warning",
  over: "bg-destructive",
  unset: "bg-muted",
};

type EnvelopeChartProps = {
  envelopes: BudgetEnvelope[];
};

function EnvelopeChart({ envelopes }: EnvelopeChartProps) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-caption text-primary-foreground">봉투별 사용률</Text>
        <Text className="text-caption text-primary-foreground">남은 30% 미만 노랑 · 초과 빨강</Text>
      </View>
      <View className="flex-row items-end gap-1.5">
        {envelopes.map((envelope) => (
          <EnvelopeBar key={envelope.envelopeId} envelope={envelope} />
        ))}
      </View>
    </View>
  );
}

function EnvelopeBar({ envelope }: { envelope: BudgetEnvelope }) {
  const health = envelopeHealth(envelope);
  const used = envelope.remainingRate === null ? null : usedPercent(envelope.remainingRate);
  const barPercent = used === null ? 0 : Math.min(100, used);
  const usedText = used === null ? "-" : `${used}%`;
  const remainingText = envelope.remaining === null ? "" : `, 남은 ${formatKRW(envelope.remaining)}`;

  return (
    <View className="flex-1 items-center gap-1" accessible accessibilityLabel={`${envelope.name} 사용률 ${usedText}${remainingText}`}>
      <Text className="text-caption tabular-nums text-primary-foreground">{usedText}</Text>
      <View className="h-20 w-6 justify-end overflow-hidden rounded-md bg-accent">
        <View className={cn("w-full rounded-md", FILL_CLASS[health])} style={{ height: `${barPercent}%` }} />
      </View>
      <Text className="text-caption text-primary-foreground" numberOfLines={1}>
        {envelopeShortName(envelope.envelopeId, envelope.name)}
      </Text>
    </View>
  );
}

export { EnvelopeChart };
export type { EnvelopeChartProps };
