import axios from "axios";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
export const TIMEOUT_QUERY_MS = 10_000;
export const TIMEOUT_MONEY_MS = 30_000;

/**
 * 공용 axios 인스턴스. 도메인 API 함수(features/<domain>/api)만 이 인스턴스를 호출한다.
 * Authorization, Idempotency-Key, X-Device-Id 같은 공통 헤더는 이 파일의 인터셉터에서만 붙인다.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_QUERY_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});
