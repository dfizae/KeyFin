/** @jest-environment node */
/// <reference types="node" />

import { api } from "@/api/client";
import { askFinanceQuestion, getCoachingSession, sendCoachingMessage, startCoachingSession } from "@/features/coaching/api";

// Only device token storage is replaced. Requests, envelope unwrapping and Zod parsers are real.
jest.mock("@/lib/session-storage", () => ({
  getAccessTokenSync: () => "synthetic-app-one", getRefreshToken: async () => null,
  saveTokens: jest.fn(), clearTokens: jest.fn(),
}));

const live = process.env.COACHING_HTTP_CONTRACT === "1" ? describe : describe.skip;
live("real frontend client → Spring MVC → Python contract", () => {
  beforeAll(() => { api.defaults.adapter = "http"; });

  it("answers a financial concept without requiring a forecast", async () => {
    const answer = await askFinanceQuestion("복리가 뭐야?", "fe-wire-concept");
    expect(answer.kind).toBe("chat");
    expect(answer.text.length).toBeGreaterThan(0);
    expect(answer.references.length).toBeGreaterThan(0);
  });

  it("creates an empty session and restores its typed history response", async () => {
    const session = await startCoachingSession("fe-wire-session");
    expect(session.messages).toHaveLength(0);
    const answer = await sendCoachingMessage(session.id, "이번 달 외식비 얼마 썼어?", "fe-wire-history");
    expect(answer.text.length).toBeGreaterThan(0);
    const saved = await getCoachingSession(session.id);
    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[1].response).toEqual({ kind: answer.kind, id: answer.id });
  });
});
