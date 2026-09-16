import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { EnvelopeDetailScreen } from "@/features/budget/components/EnvelopeDetailScreen";
import { parseEnvelopeId } from "@/features/budget/model";

// PAGE-23 봉투 상세. 홈 예산 카드의 봉투 막대와 BUDGET_ALERT 푸시(refId=envelopeId)에서 들어온다.
export default function EnvelopeDetailRoute() {
  const { envelopeId } = useLocalSearchParams();

  return (
    <View className="flex-1 bg-background">
      <EnvelopeDetailScreen envelopeId={parseEnvelopeId(envelopeId)} />
    </View>
  );
}
