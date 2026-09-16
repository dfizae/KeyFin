import "../global.css";

import { useEffect } from "react";

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

  useEffect(() => {
    // Android 개발 빌드에서만 실행하는 테스트 코드입니다.
    if (!__DEV__ || Platform.OS !== "android") return;

    async function prepareFcmTest() {
      const Notifications = await import("expo-notifications");

      await Notifications.setNotificationChannelAsync("default", {
        name: "기본 알림",
        importance: Notifications.AndroidImportance.HIGH,
      });

      let permission = await Notifications.getPermissionsAsync();

      if (permission.status !== "granted") {
        permission = await Notifications.requestPermissionsAsync();
      }

      if (permission.status !== "granted") {
        console.warn("[FCM 테스트] 알림 권한이 허용되지 않았습니다.");
        return;
      }

      const token = await Notifications.getDevicePushTokenAsync();

      console.log("[FCM 테스트 토큰]", token.data);
    }

    void prepareFcmTest().catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "알림 등록 실패";

      console.warn("[FCM 테스트]", message);
    });
  }, []);

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
