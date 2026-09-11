import { SafeAreaView } from "react-native-safe-area-context";

import { IncomeAccountScreen } from "@/features/account/components/IncomeAccountScreen";

// PAGE-05 수입 계좌 지정. 계좌·카드 연결(PAGE-04) 뒤, 소비 분석(PAGE-06) 앞에 온다.
export default function IncomeAccountRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <IncomeAccountScreen />
    </SafeAreaView>
  );
}
