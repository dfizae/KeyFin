import { create } from "zustand";

import type { AuthUser } from "@/features/auth/model";

/** 사용자 정보만 둔다. 토큰은 규칙 80 에 따라 lib/session-storage.ts(expo-secure-store)가 맡는다. */
export type { AuthUser };

/** loading 은 저장된 세션을 아직 읽는 중이라는 뜻이다. 이때 로그인 화면을 띄우면 자동 로그인이 깜빡인다. */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
  /** 앱 시작 시 저장된 세션을 반영한다. null 이면 비로그인. 토큰만 있고 사용자 정보가 없으면 user 는 null 로 둔다. */
  restore: (user: AuthUser | null, authenticated: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  signIn: (user) => set({ user, status: "authenticated" }),
  signOut: () => set({ user: null, status: "anonymous" }),
  restore: (user, authenticated) => set({ user, status: authenticated ? "authenticated" : "anonymous" }),
}));

export const selectUserName = (state: AuthState): string | null => state.user?.name ?? null;
export const selectAuthStatus = (state: AuthState): AuthStatus => state.status;
