import { Settings } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";

export default function SettingsRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background px-6" edges={["top"]}>
      <Text className="py-4 text-h1" accessibilityRole="header">
        설정
      </Text>
      <EmptyState icon={Settings} title="준비 중인 화면이에요" description="설정 기능은 아직 디자인이 확정되지 않았어요." />
    </SafeAreaView>
  );
}
