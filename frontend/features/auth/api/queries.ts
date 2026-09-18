import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seedOnboardedMocks } from "@/api/mocks/onboarding";

import { login, logout, signup } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store";
import type { LoginRequest, SignupRequest } from "@/features/auth/model";
import { unregisterThisDevice } from "@/features/notification/push";
import { clearTokens, loadOnboardingDone, loadTermsAgreed, saveSessionUser, saveTokens } from "@/lib/session-storage";

/** 로그인 성공 시 토큰을 저장소에, 사용자만 스토어에 둔다 (규칙 80: 토큰은 스토어·로그에 남기지 않는다). */
export function useLogin() {
  const signIn = useAuthStore((state) => state.signIn);

  return useMutation({
    mutationFn: (request: LoginRequest) => login(request),
    onSuccess: async (session) => {
      await saveTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      await saveSessionUser(session.user);
      const onboardingDone = await loadOnboardingDone(session.user.id);
      if (onboardingDone) seedOnboardedMocks();
      signIn(session.user, await loadTermsAgreed(session.user.id), onboardingDone);
    },
  });
}

/** 가입은 토큰을 주지 않는다. 성공하면 호출부가 로그인 화면으로 보낸다. */
export function useSignup() {
  return useMutation({
    mutationFn: (request: SignupRequest) => signup(request),
  });
}

/**
 * 로그아웃은 서버 결과와 무관하게 로컬 세션을 끝내고 남은 캐시를 비운다.
 * 토큰을 지우기 전에 이 기기의 푸시 등록을 먼저 끊는다(DELETE 에 Access Token 이 필요하다). 끊기 실패는 로그아웃을 막지 않는다.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);

  return useMutation({
    mutationFn: async () => {
      await unregisterThisDevice();
      await logout();
    },
    onSettled: async () => {
      await clearTokens();
      signOut();
      queryClient.clear();
    },
  });
}
