import { Tabs } from "expo-router";

import { TabBar } from "@/components/ui/tab-bar";

// Pencil 홈 BottomTabBar (NaYk9): 홈 · 자산 · 예산 · 리포트 · 마이
export default function TabsLayout() {
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
