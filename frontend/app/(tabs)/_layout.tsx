import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";

import { TabBar } from "@/components/ui/tab-bar";
import { selectAuthStatus, useAuthStore } from "@/features/auth/store";

// Pencil 홈 BottomTabBar (NaYk9): 홈 · 자산 · 예산 · 리포트 · 마이
export default function TabsLayout() {
  const status = useAuthStore(selectAuthStatus);

  // 저장된 세션을 읽는 동안 로그인 화면이 깜빡이지 않도록 빈 배경을 둔다 (규칙 80: 인증 검사는 그룹 레이아웃에서).
  if (status === "loading") return <View className="flex-1 bg-background" />;
  if (status === "anonymous") return <Redirect href="/(auth)/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "홈" }} />
      <Tabs.Screen name="assets" options={{ title: "자산" }} />
      <Tabs.Screen name="budget" options={{ title: "예산" }} />
      <Tabs.Screen name="report" options={{ title: "리포트" }} />
      <Tabs.Screen name="my" options={{ title: "마이" }} />
    </Tabs>
  );
}
