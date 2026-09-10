import { User } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";
import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { selectUserName, useAuthStore } from "@/features/auth/store";

// Pencil 마이페이지 (n374g) — 시안은 있고 구현 전. 로그아웃(PAGE-01 왕복 확인용)만 먼저 붙였다.
export default function MyRoute() {
  const userName = useAuthStore(selectUserName);

  return (
    <SafeAreaView className="flex-1 bg-background px-6" edges={["top"]}>
      <Text className="py-4 text-h1" accessibilityRole="header">
        마이페이지
      </Text>
      {userName === null ? null : <Text className="text-body text-muted-foreground">{userName}님</Text>}
      <EmptyState icon={User} title="준비 중인 화면이에요" description="마이페이지는 디자인이 확정됐고 구현을 준비 중이에요." />
      <View className="pb-6">
        <LogoutButton />
      </View>
    </SafeAreaView>
  );
}
