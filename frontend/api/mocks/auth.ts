import { ApiError } from "@/api/error";
import type { AuthUser, LoginRequest, LoginResponseDto } from "@/features/auth/model";

/** 로그인 응답(docs/api-contract.md AUTH)의 user. 이름은 Pencil 홈 시안(EWfx2)의 인사말과 같다. */
export const authUserMock: AuthUser = { id: 1, name: "김재영" };

/**
 * 목 모드 로그인 규칙: 백엔드 예시 계정의 비밀번호(`qwer1234@`)만 통과하고 나머지는 AUTH_001 이다.
 * 서버 없이도 성공·실패 두 화면(login, login/error)을 모두 확인하려고 둔 값이다.
 */
export const MOCK_PASSWORD = "qwer1234@";

export function loginMock({ password }: LoginRequest): LoginResponseDto {
  if (password !== MOCK_PASSWORD) {
    throw new ApiError(401, "AUTH_001", "이메일 또는 비밀번호가 올바르지 않습니다.");
  }
  return {
    accessToken: "mock.access.token",
    refreshToken: "mock.refresh.token",
    user: authUserMock,
  };
}
