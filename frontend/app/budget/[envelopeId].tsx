import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { EnvelopeDetailScreen } from "@/features/budget/components/EnvelopeDetailScreen";
import { parseEnvelopeId } from "@/features/budget/model";

// PAGE-23 봉투 상세. 홈 예산 카드의 봉투 막대와 BUDGET_ALERT 푸시(refId=envelopeId)에서 들어온다.
export default function EnvelopeDetailRoute() {
  const { envelopeId } = useLocalSearchParams();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <EnvelopeDetailScreen envelopeId={parseEnvelopeId(envelopeId)} />
    </SafeAreaView>
  );
}
