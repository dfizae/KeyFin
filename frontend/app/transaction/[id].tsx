import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { TransactionDetailScreen } from "@/features/transaction/components/TransactionDetailScreen";
import { parseTransactionId } from "@/features/transaction/model";

// PAGE-21 거래 상세. 거래 목록(전체보기·자산 탭 최근 거래·미확정 정리)의 행에서 들어온다.
export default function TransactionDetailRoute() {
  const { id } = useLocalSearchParams();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <TransactionDetailScreen transactionId={parseTransactionId(id)} />
    </SafeAreaView>
  );
}
