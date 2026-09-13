import { ChartColumn } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";

// Pencil 월간 리포트 조회 (r3Nmq) — 시안은 있고 구현 전
export default function ReportRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background px-6" edges={["top"]}>
      <Text className="py-4 text-h1" accessibilityRole="header">
        월간 리포트
      </Text>
      <EmptyState icon={ChartColumn} title="준비 중인 화면이에요" description="리포트 화면은 디자인이 확정됐고 구현을 준비 중이에요." />
    </SafeAreaView>
  );
}
