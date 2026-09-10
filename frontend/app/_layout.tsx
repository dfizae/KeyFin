import "../global.css";

import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useSessionBootstrap } from "@/features/auth/useSessionBootstrap";
import { queryClient } from "@/lib/query-client";

// GestureHandlerRootView 는 NativeWind className 대상이 아니라 style 로 채운다.
const FILL = { flex: 1 } as const;

export default function RootLayout() {
  useSessionBootstrap();

  return (
    <GestureHandlerRootView style={FILL}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
        <PortalHost />
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
