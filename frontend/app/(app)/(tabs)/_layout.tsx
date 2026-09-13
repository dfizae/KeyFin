import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";

import { TabBar } from "@/components/ui/tab-bar";
import { selectTermsAgreed, useAuthStore } from "@/features/auth/store";
import { useFinanceStatus } from "@/features/link/api/queries";

// Pencil 홈 BottomTabBar (NaYk9): 홈 · 자산 · 예산 · 리포트 · 마이
export default function TabsLayout() {
  const termsAgreed = useAuthStore(selectTermsAgreed);
  const financeStatus = useFinanceStatus();

  // 로그인 여부는 상위 (app) 그룹이 검사한다. 여기서는 온보딩 단계만 본다.
  if (termsAgreed === false) return <Redirect href="/(auth)/terms" />;
  // 금융망 연결 여부는 서버가 가진 값이라 조회가 끝날 때까지 기다린다 (GET /links/status).
  if (financeStatus.isPending) return <View className="flex-1 bg-background" />;
  if (financeStatus.data === false) return <Redirect href="/onboarding/finance-email" />;

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
