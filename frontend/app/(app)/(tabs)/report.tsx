import { ChartColumn } from "lucide-react-native";

import { View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { ScreenHeader } from "@/components/ui/screen-header";

// Pencil 월간 리포트 조회 (r3Nmq) — 시안은 있고 구현 전
export default function ReportRoute() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="월간 리포트" />
      <View className="flex-1 bg-background px-6">
        <EmptyState icon={ChartColumn} title="준비 중인 화면이에요" description="리포트 화면은 디자인이 확정됐고 구현을 준비 중이에요." />
      </View>
    </View>
  );
}
