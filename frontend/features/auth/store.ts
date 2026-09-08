import { create } from "zustand";

import { USE_MOCKS } from "@/api/client";
import { authUserMock } from "@/api/mocks/auth";

/** 로그인 응답(docs/api-contract.md AUTH)의 user. 토큰은 여기 두지 않고 expo-secure-store 에 둔다 (TBD, 로그인 화면 PAGE-01 과 함께). */
export type AuthUser = { id: number; name: string };

type AuthState = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: USE_MOCKS ? authUserMock : null,
  setUser: (user) => set({ user }),
}));

export const selectUserName = (state: AuthState): string | null => state.user?.name ?? null;
