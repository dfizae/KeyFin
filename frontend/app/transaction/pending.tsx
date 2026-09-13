import { SafeAreaView } from "react-native-safe-area-context";

import { PendingCleanupScreen } from "@/features/transaction/components/PendingCleanupScreen";

// PAGE-22 미확정 정리. 저녁 21:00 CLEANUP 푸시의 진입점이다 (docs/frontend-spec.md §3).
export default function PendingCleanupRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <PendingCleanupScreen />
    </SafeAreaView>
  );
}
