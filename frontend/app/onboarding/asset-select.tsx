import { SafeAreaView } from "react-native-safe-area-context";

import { AssetSelectScreen } from "@/features/link/components/AssetSelectScreen";

// PAGE-04 계좌·카드 연결. 금융망 이메일 연결(PAGE-03B) 뒤, 수입 계좌 지정(PAGE-05) 앞에 온다.
export default function AssetSelectRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <AssetSelectScreen />
    </SafeAreaView>
  );
}
