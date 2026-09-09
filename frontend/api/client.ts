import axios from "axios";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
export const API_PREFIX = "/api/v1";
/** 호스트가 비어 있으면 도메인 함수가 api/mocks 값을 돌려준다 (docs/api-guide.md §9). */
export const USE_MOCKS = API_BASE_URL === "";
export const TIMEOUT_QUERY_MS = 10_000;
export const TIMEOUT_MONEY_MS = 30_000;

/**
 * 공용 axios 인스턴스. 도메인 API 함수(features/<domain>/api)만 이 인스턴스를 호출한다.
 * 경로는 `/api/v1` 을 뺀 값만 넘긴다 (`api.get("/room")`).
 * Authorization 헤더, 401 갱신 단일 실행, ApiError 정규화는 인터셉터로 붙인다 (TBD, docs/api-guide.md §3-1).
 */
export const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: TIMEOUT_QUERY_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});
