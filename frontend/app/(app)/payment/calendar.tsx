import { SafeAreaView } from "react-native-safe-area-context";

import { PaymentCalendarScreen } from "@/features/payment/components/PaymentCalendarScreen";

// PAGE-24 결제 캘린더. 홈 캘린더 팝오버와 자산 탭 정기결제에서 들어온다. 달은 month 검색 파라미터.
export default function PaymentCalendarRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <PaymentCalendarScreen />
    </SafeAreaView>
  );
}
