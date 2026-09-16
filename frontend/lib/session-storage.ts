import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * 토큰 저장소. 규칙 80 에 따라 액세스·리프레시 토큰은 expo-secure-store 에만 둔다.
 *
 * SecureStore 는 웹에서 동작하지 않는데, 규칙이 금지하는 localStorage 로 폴백하지 않고
 * **웹에서는 메모리에만** 보관한다. 그래서 웹은 새로고침하면 다시 로그인해야 하고,
 * 자동 로그인은 네이티브에서만 동작한다. (docs/frontend-spec.md PAGE-01)
 */
const ACCESS_KEY = "keyfin.accessToken";
const REFRESH_KEY = "keyfin.refreshToken";
const USER_KEY = "keyfin.user";
const TERMS_KEY_PREFIX = "keyfin.terms.";
const ONBOARDING_KEY_PREFIX = "keyfin.onboarding.";

const isWeb = Platform.OS === "web";

const memory = new Map<string, string>();

async function read(key: string): Promise<string | null> {
  if (isWeb) return memory.get(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  if (isWeb) {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

/** 인터셉터가 매 요청마다 읽으므로 비동기 저장소 앞에 동기 캐시를 둔다. */
let cachedAccessToken: string | null = null;

export function getAccessTokenSync(): string | null {
  return cachedAccessToken;
}

export async function loadTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const [accessToken, refreshToken] = await Promise.all([read(ACCESS_KEY), read(REFRESH_KEY)]);
  cachedAccessToken = accessToken;
  return { accessToken, refreshToken };
}

export async function getRefreshToken(): Promise<string | null> {
  return read(REFRESH_KEY);
}

export async function saveTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
  cachedAccessToken = tokens.accessToken;
  await write(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken !== undefined) await write(REFRESH_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  cachedAccessToken = null;
  await Promise.all([write(ACCESS_KEY, null), write(REFRESH_KEY, null), write(USER_KEY, null)]);
}

/**
 * 세션 사용자(id·name). 계약에 프로필 조회 API 가 없어서 앱을 다시 켰을 때 이름을 되살릴 방법이 이것뿐이다.
 * 비밀 값이 아니지만 토큰과 수명을 같이 해야 해서 같은 저장소에 둔다.
 */
export async function saveSessionUser(user: { id: number; name: string }): Promise<void> {
  await write(USER_KEY, JSON.stringify(user));
}

export async function loadSessionUser(): Promise<{ id: number; name: string } | null> {
  const raw = await read(USER_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { id, name } = parsed as { id?: unknown; name?: unknown };
    return typeof id === "number" && typeof name === "string" ? { id, name } : null;
  } catch {
    return null;
  }
}

/**
 * 약관 동의 여부 (PAGE-03). 서버 API 가 없어 기기에만 남기고, 기기를 같이 쓰는 다른 계정과 섞이지 않도록 사용자별로 둔다.
 * 로그아웃해도 지우지 않는다 — 같은 사용자가 다시 로그인하면 약관을 또 보여줄 이유가 없다.
 */
export async function loadTermsAgreed(userId: number): Promise<boolean> {
  return (await read(`${TERMS_KEY_PREFIX}${userId}`)) === "1";
}

export async function saveTermsAgreed(userId: number): Promise<void> {
  await write(`${TERMS_KEY_PREFIX}${userId}`, "1");
}

/**
 * 온보딩 완료 여부. 백엔드와 합의한 판정("첫 예산 확정 성공 = 완료", 2026-09-11)을 서버 필드가 생기기 전까지 기기에 기록한다.
 * 홈 게이트가 이 값을 먼저 보므로 금융망 상태 조회(목은 리로드마다 초기화된다)에 흔들리지 않는다. 서버 값이 오면 그걸로 바꾼다.
 */
export async function loadOnboardingDone(userId: number): Promise<boolean> {
  return (await read(`${ONBOARDING_KEY_PREFIX}${userId}`)) === "1";
}

export async function saveOnboardingDone(userId: number): Promise<void> {
  await write(`${ONBOARDING_KEY_PREFIX}${userId}`, "1");
}
