import { SafeAreaView } from "react-native-safe-area-context";

import { SpendingEnvelopesScreen } from "@/features/budget/components/SpendingEnvelopesScreen";

// PAGE-06 소비 분석 결과 B(봉투별). 다음은 예산 제안(PAGE-07).
export default function SpendingEnvelopesRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <SpendingEnvelopesScreen />
    </SafeAreaView>
  );
}
