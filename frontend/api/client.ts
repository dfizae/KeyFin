import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { NETWORK_ERROR_CODE, TIMEOUT_ERROR_CODE, toApiError } from "@/api/error";
import { clearTokens, getAccessTokenSync, getRefreshToken, saveTokens } from "@/lib/session-storage";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
export const API_PREFIX = "/api/v1";
/** 호스트가 비어 있으면 도메인 함수가 api/mocks 값을 돌려준다 (docs/api-guide.md §9). */
export const USE_MOCKS = API_BASE_URL === "";
export const TIMEOUT_QUERY_MS = 10_000;
export const TIMEOUT_MONEY_MS = 30_000;

/** Bearer 를 붙이지 않는 경로 (docs/api-contract.md §1). 로그아웃은 Access Token 이 필요하다. */
const AUTH_FREE_PATHS = ["/auth/signup", "/auth/login", "/auth/refresh"];

function isAuthFree(url: string | undefined): boolean {
  return url !== undefined && AUTH_FREE_PATHS.some((path) => url.startsWith(path));
}

/**
 * 공용 axios 인스턴스. 도메인 API 함수(features/<domain>/api)만 이 인스턴스를 호출한다.
 * 경로는 `/api/v1` 을 뺀 값만 넘긴다 (`api.get("/room")`).
 */
export const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: TIMEOUT_QUERY_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/** 토큰 재발급 전용. 인터셉터가 붙지 않아 401 재귀를 만들지 않는다. */
const refreshClient = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: TIMEOUT_QUERY_MS,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

type Envelope = { success: unknown; data: unknown };

function isEnvelope(body: unknown): body is Envelope {
  return typeof body === "object" && body !== null && "success" in body && "data" in body;
}

/**
 * 공통 봉투 `{ success, code, message, data }` 를 벗겨 본문만 남긴다 (2026-09-10 백엔드 AUTH 구현본 확인).
 * 봉투를 아는 곳은 여기뿐이고 도메인 함수·model 은 데이터만 본다.
 */
export function unwrapEnvelope(body: unknown): unknown {
  return isEnvelope(body) ? body.data : body;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** 갱신 실패로 세션이 끝났을 때 앱이 로그인 화면으로 보내도록 등록하는 자리 (api 층이 라우터를 직접 알지 않는다). */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** 동시에 터진 401 이 갱신을 여러 번 호출하지 않도록 하나의 Promise 를 공유한다. */
let refreshPromise: Promise<string> | null = null;

async function requestNewAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null) throw new Error("no refresh token");

  const { data } = await refreshClient.post("/auth/refresh", { refreshToken });
  const payload = unwrapEnvelope(data) as { accessToken?: unknown };
  if (typeof payload?.accessToken !== "string") throw new Error("invalid refresh response");

  await saveTokens({ accessToken: payload.accessToken });
  return payload.accessToken;
}

function refreshAccessToken(): Promise<string> {
  refreshPromise ??= requestNewAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessTokenSync();
  if (token !== null && !isAuthFree(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    response.data = unwrapEnvelope(response.data);
    return response;
  },
  async (error: AxiosError) => {
    if (error.response === undefined) {
      const code = error.code === "ECONNABORTED" ? TIMEOUT_ERROR_CODE : NETWORK_ERROR_CODE;
      throw toApiError(0, null, code);
    }

    const { status, data } = error.response;
    const config = error.config as RetriableConfig | undefined;
    const canRetry = status === 401 && config !== undefined && config._retried !== true && !isAuthFree(config.url);

    if (canRetry) {
      try {
        const accessToken = await refreshAccessToken();
        config._retried = true;
        config.headers.Authorization = `Bearer ${accessToken}`;
        return await api.request(config);
      } catch {
        await clearTokens();
        onUnauthorized?.();
      }
    }

    throw toApiError(status, data);
  }
);
