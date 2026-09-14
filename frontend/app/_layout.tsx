import "../global.css";

import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useSessionBootstrap } from "@/features/auth/useSessionBootstrap";
import { queryClient } from "@/lib/query-client";

// GestureHandlerRootView 는 NativeWind className 대상이 아니라 style 로 채운다.
const FILL = { flex: 1 } as const;

/**
 * 웹(개발 중 확인용)에는 상태 표시줄이 없어 헤더가 창 맨 위에 붙는다. 폰과 비슷하게 보이도록
 * 상태 표시줄 높이만큼 위를 비워 둔다. 기기에서는 SafeAreaView 가 실제 값을 쓰므로 0 이다.
 */
const WEB_STATUS_BAR_HEIGHT = 44;
const STATUS_BAR_PREVIEW = { flex: 1, paddingTop: Platform.OS === "web" ? WEB_STATUS_BAR_HEIGHT : 0 } as const;

export default function RootLayout() {
  useSessionBootstrap();

  return (
    <GestureHandlerRootView style={FILL}>
      <QueryClientProvider client={queryClient}>
        <View className="bg-background" style={STATUS_BAR_PREVIEW}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
        <PortalHost />
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
