import { act, renderHook, waitFor } from "@testing-library/react-native";

import { ApiError } from "@/api/error";
import { acknowledgeCoachingNotification, getCoachingAnswer, getCoachingRecord, getCoachingSession, sendCoachingMessage, startCoachingSession } from "@/features/coaching/api";
import { useCoachingChat } from "@/features/coaching/useCoachingChat";

jest.mock("@/features/coaching/api", () => ({
  getCoachingSession: jest.fn(), getCoachingRecord: jest.fn(), getCoachingAnswer: jest.fn(), acknowledgeCoachingNotification: jest.fn(),
  sendCoachingMessage: jest.fn(), startCoachingSession: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(startCoachingSession).mockResolvedValue({ id: "session-1", coaching_id: null, created_at: 1, expires_at: 2, messages: [] });
  jest.mocked(sendCoachingMessage).mockResolvedValue({ id: "answer-1", kind: "chat", status: "answered",
    text: "답변", references: [], period: null, fallback: false });
});

it("loads the original coaching before acknowledging and reuses it for follow-up context", async () => {
  const order: string[] = [];
  jest.mocked(getCoachingRecord).mockImplementation(async () => {
    order.push("load");
    return { id: "coaching-1", kind: "coaching", status: "answered", text: "원래 코칭", references: [], period: null, fallback: false };
  });
  jest.mocked(acknowledgeCoachingNotification).mockImplementation(async () => {
    order.push("ack");
    return { event_id: "notice-1", type: "COACHING", coaching_id: "coaching-1", text: "알림", created_at: 1, acknowledged: true };
  });
  const { result } = await renderHook(() => useCoachingChat(undefined, "coaching-1", "notice-1"));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(order).toEqual(["load", "ack"]);
  expect(result.current.messages[0]?.text).toBe("원래 코칭");
  await act(async () => { await result.current.send("왜 이 코칭이 나왔어?"); });
  expect(startCoachingSession).toHaveBeenCalledWith(expect.any(String), "coaching-1");
});

it("never acknowledges a notification whose coaching cannot be retrieved", async () => {
  jest.mocked(getCoachingRecord).mockRejectedValue(new ApiError(404, "NOT_FOUND", "코칭 없음"));
  const { result } = await renderHook(() => useCoachingChat(undefined, "missing", "notice-1"));
  await waitFor(() => expect(result.current.error).toBe("코칭 없음"));
  expect(acknowledgeCoachingNotification).not.toHaveBeenCalled();
});

it("reuses one session when the user asks two consecutive questions", async () => {
  const { result } = await renderHook(() => useCoachingChat());
  await act(async () => { await result.current.send("복리가 뭐야?"); });
  await act(async () => { await result.current.send("그럼 적금은?"); });
  expect(startCoachingSession).toHaveBeenCalledTimes(1);
  expect(jest.mocked(sendCoachingMessage).mock.calls.map((call) => call[0])).toEqual(["session-1", "session-1"]);
  expect(result.current.messages).toHaveLength(4);
});

it("reuses the failed turn key when an uncertain timeout is retried", async () => {
  jest.mocked(sendCoachingMessage).mockRejectedValueOnce(new ApiError(504, "COACHING_TIMEOUT", "재시도"));
  const { result } = await renderHook(() => useCoachingChat());
  await act(async () => { await result.current.send("이번 달 잔액 예측해줘"); });
  expect(result.current.retryPending).toBe(true);
  await act(async () => { await result.current.retry(); });
  const calls = jest.mocked(sendCoachingMessage).mock.calls;
  expect(calls[0]).toEqual(calls[1]);
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.retryPending).toBe(false);
});

it("restores saved messages when opening an existing session", async () => {
  jest.mocked(getCoachingSession).mockResolvedValue({ id: "saved-1", coaching_id: null, created_at: 1, expires_at: 2,
    messages: [{ role: "user", content: "이전 질문" }, { role: "assistant", content: "이전 답변" }] });
  const { result } = await renderHook(() => useCoachingChat("saved-1"));
  await waitFor(() => expect(result.current.messages).toHaveLength(2));
  expect(startCoachingSession).not.toHaveBeenCalled();
});

it("restores official sources and forecast dates from saved response references", async () => {
  jest.mocked(getCoachingSession).mockResolvedValue({ id: "saved", coaching_id: null, created_at: 1, expires_at: 2,
    messages: [{ role: "assistant", content: "저장된 금융 설명", response: { kind: "chat", id: "answer-1" } },
      { role: "assistant", content: "저장된 코칭", response: { kind: "coaching", id: "coaching-1" } }] });
  jest.mocked(getCoachingAnswer).mockResolvedValue({ id: "answer-1", kind: "chat", status: "needs_source", text: "확인 필요",
    references: [{ id: "official", title: "공식 자료", url: "https://www.bok.or.kr" }], period: null, fallback: true });
  jest.mocked(getCoachingRecord).mockResolvedValue({ id: "coaching-1", kind: "coaching", status: "partial", text: "부분 예측",
    references: [], period: { asOf: "2026-09-03", start: "2026-09-04", end: "2026-09-30" }, fallback: true });
  const { result } = await renderHook(() => useCoachingChat("saved"));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.messages[0]?.answer?.references[0]?.id).toBe("official");
  expect(result.current.messages[0]?.answer?.status).toBe("needs_source");
  expect(result.current.messages[1]?.answer?.period?.start).toBe("2026-09-04");
  expect(result.current.messages[1]?.answer?.fallback).toBe(true);
});

it("keeps a failed source's saved text and restores it on retry without losing other messages", async () => {
  jest.mocked(getCoachingSession).mockResolvedValue({ id: "saved", coaching_id: null, created_at: 1, expires_at: 2,
    messages: [{ role: "assistant", content: "저장된 설명", response: { kind: "chat", id: "answer-1" } },
      { role: "user", content: "그 다음 질문" }] });
  jest.mocked(getCoachingAnswer).mockRejectedValueOnce(new ApiError(503, "UPSTREAM", "일시 중단"))
    .mockResolvedValue({ id: "answer-1", kind: "chat", status: "answered", text: "원본 설명", references: [], period: null, fallback: false });
  const { result } = await renderHook(() => useCoachingChat("saved"));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.messages[0]?.text).toBe("저장된 설명");
  expect(result.current.error).toContain("일부 답변의 근거");
  await act(async () => { await result.current.retry(); });
  expect(result.current.messages[0]?.text).toBe("원본 설명");
  expect(result.current.messages[1]?.text).toBe("그 다음 질문");
  expect(result.current.error).toBeNull();
});

it("does not render a response whose ID differs from the session reference", async () => {
  jest.mocked(getCoachingSession).mockResolvedValue({ id: "saved", coaching_id: null, created_at: 1, expires_at: 2,
    messages: [{ role: "assistant", content: "내 저장된 설명", response: { kind: "chat", id: "mine" } }] });
  jest.mocked(getCoachingAnswer).mockResolvedValue({ id: "different", kind: "chat", status: "answered", text: "다른 자료",
    references: [], period: null, fallback: false });
  const { result } = await renderHook(() => useCoachingChat("saved"));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.messages[0]?.text).toBe("내 저장된 설명");
  expect(result.current.messages[0]?.answer).toBeUndefined();
  expect(result.current.error).not.toBeNull();
});
