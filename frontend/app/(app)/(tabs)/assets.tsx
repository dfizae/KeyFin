import { SafeAreaView } from "react-native-safe-area-context";

import { AssetsScreen } from "@/features/account/components/AssetsScreen";

// PAGE-11 자산 (Pencil 자산관리 UjYhB). 탭바는 (tabs) 레이아웃이 그린다.
export default function AssetsRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <AssetsScreen />
    </SafeAreaView>
  );
}
