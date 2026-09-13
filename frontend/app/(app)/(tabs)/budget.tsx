import { SafeAreaView } from "react-native-safe-area-context";

import { BudgetScreen } from "@/features/budget/components/BudgetScreen";

// 헤더가 안전 영역까지 bg-card 로 이어지도록 SafeAreaView 배경을 카드 색으로 둔다 (Pencil budget Header V1nCzt).
export default function BudgetRoute() {
  return (
    <SafeAreaView className="flex-1 bg-card" edges={["top"]}>
      <BudgetScreen />
    </SafeAreaView>
  );
}
