import { Redirect, Stack } from "expo-router";

import { selectAuthStatus, selectFinanceLinked, selectTermsAgreed, useAuthStore } from "@/features/auth/store";

// 인증 화면 그룹. 이미 로그인된 사용자는 홈으로 돌려보낸다 (규칙 80: 인증 검사는 그룹 레이아웃에서).
// 단 약관(PAGE-03)은 로그인한 뒤에 보는 화면이라 미동의 상태에서는 그대로 둔다.
export default function AuthLayout() {
  const status = useAuthStore(selectAuthStatus);
  const termsAgreed = useAuthStore(selectTermsAgreed);
  const financeLinked = useAuthStore(selectFinanceLinked);

  // 약관·금융망 연결이 남아 있으면 홈으로 보내지 않는다. 각 화면이 다음 단계를 이어서 안내한다.
  if (status === "authenticated" && termsAgreed !== false && financeLinked !== false) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
