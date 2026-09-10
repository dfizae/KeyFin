import { ContractMismatchError } from "@/lib/contract";

/**
 * AUTH 계약 (docs/api-contract.md AUTH, 2026-09-10 백엔드 구현본 확인).
 * 응답 봉투는 api/client.ts 인터셉터가 벗기므로 여기서는 data 안의 모양만 다룬다.
 */
export type AuthUser = { id: number; name: string };

export type LoginRequest = { email: string; password: string };

export type SignupRequest = { email: string; password: string; name: string };

export type SignupResponseDto = { userId: number };

export type LoginResponseDto = {
  accessToken: string;
  refreshToken: string;
  user: { id: number; name: string };
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

function requiredToken(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "") throw new ContractMismatchError(field);
  return value;
}

export function toAuthSession(dto: LoginResponseDto): AuthSession {
  if (!Number.isInteger(dto.user?.id)) throw new ContractMismatchError("user.id");
  if (typeof dto.user?.name !== "string") throw new ContractMismatchError("user.name");

  return {
    accessToken: requiredToken(dto.accessToken, "accessToken"),
    refreshToken: requiredToken(dto.refreshToken, "refreshToken"),
    user: { id: dto.user.id, name: dto.user.name },
  };
}

/** 이메일 형식만 본다. 비밀번호 규칙은 서버(COMMON_001)가 정한다 — 클라이언트에서 추측하지 않는다. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL.test(email.trim());
}

export function canSubmitLogin(email: string, password: string): boolean {
  return isValidEmail(email) && password.length > 0;
}

/** 가입도 같은 기준이다. 이름은 공백만 있으면 안 된다 */
export function canSubmitSignup(email: string, password: string, name: string): boolean {
  return canSubmitLogin(email, password) && name.trim().length > 0;
}
