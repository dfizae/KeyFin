import { useRouter } from "expo-router";
import { ChevronRight, User } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { selectUserName, useAuthStore } from "@/features/auth/store";

const SETTINGS_ROUTE = "/my/settings";

// Pencil 마이페이지 (n374g) — 시안은 있고 구현 전. 설정(PAGE-27) 진입과 로그아웃만 먼저 붙였다.
export default function MyRoute() {
  const router = useRouter();
  const userName = useAuthStore(selectUserName);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="마이페이지" />
      <View className="flex-1 bg-background px-6">
      {userName === null ? null : <Text className="text-body text-card-foreground">{userName}님</Text>}
      <View className="pt-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="설정"
          className="min-h-touch flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3 active:opacity-70"
          onPress={() => router.push(SETTINGS_ROUTE)}
        >
          <Text className="text-label text-foreground">설정</Text>
          <Icon as={ChevronRight} size={18} className="text-card-foreground" />
        </Pressable>
      </View>

      <EmptyState icon={User} title="준비 중인 화면이에요" description="연결 관리·프로필은 아직 준비 중이에요." />
      <View className="pb-6">
        <LogoutButton />
      </View>
      </View>
    </View>
  );
}
