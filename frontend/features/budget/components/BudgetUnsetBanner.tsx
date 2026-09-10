import { useRouter } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatMonthKeyLabel } from "@/lib/date";

// Pencil home/p0/budget-unset (XVFf1) BudgetUnsetBanner (sihjf): bg-warning-muted · radius 20 · padding 20 · gap 12 · CTA h-button-lg.
const PROPOSAL_ROUTE = "/onboarding/budget-proposal";

export const BUDGET_UNSET_CTA = "이 예산으로 시작하기";

type BudgetUnsetBannerProps = {
  /** "YYYYMM" */
  month: string;
};

function BudgetUnsetBanner({ month }: BudgetUnsetBannerProps) {
  const router = useRouter();

  return (
    <View className="gap-3 rounded-xl bg-warning-muted p-5" accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-2">
        <Icon as={TriangleAlert} size={18} className="text-warning" />
        <Text className="text-h3 text-foreground">{formatMonthKeyLabel(month)} 예산이 아직 없어요</Text>
      </View>
      <Text className="text-body-sm text-muted-foreground">
        지난 소비를 분석해 봉투 7종 예산을 제안했어요. 승인하면 벽 보드와 잔액이 켜져요.
      </Text>
      <Button size="lg" className="h-button-lg rounded-lg" onPress={() => router.push(PROPOSAL_ROUTE)} accessibilityLabel={BUDGET_UNSET_CTA}>
        <Text>{BUDGET_UNSET_CTA}</Text>
      </Button>
    </View>
  );
}

export { BudgetUnsetBanner };
export type { BudgetUnsetBannerProps };
