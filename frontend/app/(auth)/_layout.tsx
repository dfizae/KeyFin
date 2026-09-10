import { Redirect, Stack } from "expo-router";

import { selectAuthStatus, useAuthStore } from "@/features/auth/store";

// 인증 화면 그룹. 이미 로그인된 사용자는 홈으로 돌려보낸다 (규칙 80: 인증 검사는 그룹 레이아웃에서).
export default function AuthLayout() {
  const status = useAuthStore(selectAuthStatus);

  if (status === "authenticated") return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
