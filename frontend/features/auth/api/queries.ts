import { useMutation, useQueryClient } from "@tanstack/react-query";

import { login, logout } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store";
import type { LoginRequest } from "@/features/auth/model";
import { clearTokens, saveSessionUser, saveTokens } from "@/lib/session-storage";

/** 로그인 성공 시 토큰을 저장소에, 사용자만 스토어에 둔다 (규칙 80: 토큰은 스토어·로그에 남기지 않는다). */
export function useLogin() {
  const signIn = useAuthStore((state) => state.signIn);

  return useMutation({
    mutationFn: (request: LoginRequest) => login(request),
    onSuccess: async (session) => {
      await saveTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      await saveSessionUser(session.user);
      signIn(session.user);
    },
  });
}

/** 로그아웃은 서버 결과와 무관하게 로컬 세션을 끝내고 남은 캐시를 비운다. */
export function useLogout() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);

  return useMutation({
    mutationFn: () => logout(),
    onSettled: async () => {
      await clearTokens();
      signOut();
      queryClient.clear();
    },
  });
}
