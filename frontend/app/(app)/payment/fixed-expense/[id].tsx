import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { FixedExpenseFormScreen } from "@/features/payment/components/FixedExpenseFormScreen";
import { parseFixedExpenseRoute } from "@/features/payment/model";

// PAGE-26 고정지출 등록·수정. /payment/fixed-expense/new 는 등록, /payment/fixed-expense/{id} 는 수정이다.
export default function FixedExpenseRoute() {
  const { id } = useLocalSearchParams();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <FixedExpenseFormScreen route={parseFixedExpenseRoute(id)} />
    </SafeAreaView>
  );
}
