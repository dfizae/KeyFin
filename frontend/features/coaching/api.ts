import { api, USE_MOCKS } from "@/api/client";
import { ApiError } from "@/api/error";
import { parseCoachingId, toCoachingAnswer, toCoachingNotification, toCoachingNotifications, toCoachingSession } from "@/features/coaching/model";

const TIMEOUT_COACHING_MS = 70_000;
function requireConnection(): void {
  // This feature never invents a successful model response when the backend is absent.
  if (USE_MOCKS) throw new ApiError(503, "COACHING_UNAVAILABLE", "AI 코칭 서버가 아직 연결되지 않았어요.");
}
function requestConfig(key: string) {
  return { timeout: TIMEOUT_COACHING_MS, headers: { "Idempotency-Key": key } };
}

export async function startCoachingSession(key: string, coachingId?: string) {
  requireConnection();
  const body = coachingId === undefined ? {} : { coaching_id: parseCoachingId(coachingId) };
  const { data } = await api.post<unknown>("/coaching/sessions", body, requestConfig(key));
  return toCoachingSession(data);
}

export async function getCoachingSession(id: string) {
  requireConnection();
  const { data } = await api.get<unknown>(`/coaching/sessions/${parseCoachingId(id)}`);
  return toCoachingSession(data);
}

export async function sendCoachingMessage(sessionId: string, question: string, key: string) {
  requireConnection();
  const { data } = await api.post<unknown>(`/coaching/sessions/${parseCoachingId(sessionId)}/messages`,
    { question }, requestConfig(key));
  return toCoachingAnswer(data);
}

export async function askFinanceQuestion(question: string, key: string) {
  requireConnection();
  const { data } = await api.post<unknown>("/coaching/questions", { question }, requestConfig(key));
  return toCoachingAnswer(data);
}

export async function getCoachingRecord(id: string) {
  requireConnection();
  const { data } = await api.get<unknown>(`/coaching/records/${parseCoachingId(id)}`);
  return toCoachingAnswer(data);
}

export async function getCoachingAnswer(id: string) {
  requireConnection();
  const { data } = await api.get<unknown>(`/coaching/answers/${parseCoachingId(id)}`);
  return toCoachingAnswer(data);
}

export async function getCoachingNotifications() {
  requireConnection();
  const { data } = await api.get<unknown>("/coaching/notifications");
  return toCoachingNotifications(data);
}

export async function acknowledgeCoachingNotification(id: string, key: string) {
  requireConnection();
  const { data } = await api.post<unknown>(`/coaching/notifications/${parseCoachingId(id)}/ack`, {}, requestConfig(key));
  return toCoachingNotification(data);
}
