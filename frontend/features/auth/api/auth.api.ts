import { USE_MOCKS, api } from "@/api/client";
import { loginMock } from "@/api/mocks/auth";
import { withMockLatency } from "@/api/mocks/latency";
import { toAuthSession, type AuthSession, type LoginRequest, type LoginResponseDto } from "@/features/auth/model";

/** POST /auth/login — Access 30분 · Refresh 14일 (docs/api-contract.md AUTH, FR-USR-01). Bearer 불필요. */
export async function login(request: LoginRequest): Promise<AuthSession> {
  if (USE_MOCKS) return toAuthSession(await withMockLatency(loginMock(request)));
  const { data } = await api.post<LoginResponseDto>("/auth/login", request);
  return toAuthSession(data);
}

/**
 * POST /auth/logout — 서버의 Refresh Token 을 지운다. Access Token 이 필요하다.
 * 이미 발급된 Access Token 은 만료까지 유효하므로 호출부가 로컬 토큰도 반드시 지운다.
 * 서버가 실패해도 로컬 세션은 끝내야 하므로 오류를 삼킨다.
 */
export async function logout(): Promise<void> {
  if (USE_MOCKS) {
    await withMockLatency(null);
    return;
  }
  try {
    await api.post("/auth/logout");
  } catch {
    // 서버 상태와 무관하게 로컬 로그아웃은 진행한다
  }
}
