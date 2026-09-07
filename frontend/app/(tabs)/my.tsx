import { User } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";

// Pencil 마이페이지 (n374g) — 시안은 있고 구현 전
export default function MyRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background px-6" edges={["top"]}>
      <Text className="py-4 text-h1" accessibilityRole="header">
        마이페이지
      </Text>
      <EmptyState icon={User} title="준비 중인 화면이에요" description="마이페이지는 디자인이 확정됐고 구현을 준비 중이에요." />
    </SafeAreaView>
  );
}
