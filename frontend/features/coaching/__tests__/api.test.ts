import { api } from "@/api/client";
import { startCoachingSession, sendCoachingMessage } from "@/features/coaching/api";

jest.mock("@/api/client", () => {
  const axios = jest.requireActual<typeof import("axios")>("axios");
  return { USE_MOCKS: false, api: axios.default.create() };
});

describe("authenticated app coaching API", () => {
  it("sends an empty session and stable request key without an AI credential", async () => {
    // Given: a wire adapter recording the browser-facing request.
    const observed: { path?: string; body?: string; key?: unknown; authorization?: unknown } = {};
    api.defaults.adapter = async (config) => {
      observed.path = config.url;
      observed.body = config.data;
      observed.key = config.headers.get("Idempotency-Key");
      observed.authorization = config.headers.get("Authorization");
      return { status: 200, statusText: "OK", headers: {}, config,
        data: { id: "session-1", coaching_id: null, created_at: 1, expires_at: 2, messages: [] } };
    };
    // When / Then: app JWT policy belongs to the shared client, never an AI server token here.
    await startCoachingSession("retry-key");
    expect(observed).toEqual({ path: "/coaching/sessions", body: "{}", key: "retry-key", authorization: undefined });
  });

  it("preserves the question and session when a follow-up receives needs_data", async () => {
    const calls: string[] = [];
    api.defaults.adapter = async (config) => {
      calls.push(`${config.url}:${config.data}`);
      return { status: 200, statusText: "OK", headers: {}, config, data: {
        id: "answer-1", answer_type: "data_request", status: "needs_data", text: "거래 자료 필요",
        wording_source: "template", model: "not_called", fallback_reason: "twin_not_connected", created_at: 1, evidence: {},
      } };
    };
    const answer = await sendCoachingMessage("session-1", "내 지출 알려줘", "turn-1");
    expect(answer.status).toBe("needs_data");
    expect(calls).toEqual(['/coaching/sessions/session-1/messages:{"question":"내 지출 알려줘"}']);
  });

  it("rejects a malformed resource ID before the HTTP request", async () => {
    let calls = 0;
    api.defaults.adapter = async () => { calls += 1; throw new Error("unexpected transport"); };
    await expect(sendCoachingMessage("../other-owner", "질문", "key")).rejects.toThrow();
    expect(calls).toBe(0);
  });
});
