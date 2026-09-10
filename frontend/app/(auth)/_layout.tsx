import { Redirect, Stack } from "expo-router";

import { selectAuthStatus, selectTermsAgreed, useAuthStore } from "@/features/auth/store";

// 인증 화면 그룹. 이미 로그인된 사용자는 홈으로 돌려보낸다 (규칙 80: 인증 검사는 그룹 레이아웃에서).
// 단 약관(PAGE-03)은 로그인한 뒤에 보는 화면이라 미동의 상태에서는 그대로 둔다.
export default function AuthLayout() {
  const status = useAuthStore(selectAuthStatus);
  const termsAgreed = useAuthStore(selectTermsAgreed);

  if (status === "authenticated" && termsAgreed !== false) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
