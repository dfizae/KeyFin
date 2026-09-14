/// <reference types="node" />

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { renderHook, waitFor } from "@testing-library/react-native";
import { getCoachingAnswer, getCoachingRecord, getCoachingSession } from "@/features/coaching/api";
import { toCoachingAnswer, toCoachingSession } from "@/features/coaching/model";
import { useCoachingChat } from "@/features/coaching/useCoachingChat";

jest.mock("@/features/coaching/api", () => ({
  getCoachingSession: jest.fn(), getCoachingAnswer: jest.fn(), getCoachingRecord: jest.fn(),
  acknowledgeCoachingNotification: jest.fn(), sendCoachingMessage: jest.fn(), startCoachingSession: jest.fn(),
}));

// Opt-in verification of recorded, non-sensitive API responses. Raw experiment output belongs
// outside source control. CI's deterministic model/component tests do not require these files.
const fixtureDirectory = process.env.COACHING_API_FIXTURE_DIR;
const recorded = fixtureDirectory ? describe : describe.skip;
const names = ["concept", "personal-accounts", "scope-unconnected-account", "scope-non-financial",
  "history-after-cancel", "forecast-before", "risk-after", "risk-before", "history-before-cancel", "forecast-after"] as const;

function recordedResponse(name: string): unknown {
  if (!fixtureDirectory) throw new Error("COACHING_API_FIXTURE_DIR is required");
  const bytes = readFileSync(join(fixtureDirectory, `${name}.json`));
  const manifest: Record<string, { sha256: string; bytes: number }> = JSON.parse(
    readFileSync(join(fixtureDirectory, "manifest.json"), "utf8"));
  const digest = createHash("sha256").update(bytes).digest("hex");
  expect(digest).toBe(manifest[`${name}.json`].sha256);
  expect(bytes.length).toBe(manifest[`${name}.json`].bytes);
  console.info(`contract:${name}:sha256:${digest}`);
  return JSON.parse(bytes.toString("utf8"));
}

recorded("recorded GPU API response contract", () => {
  it.each(names)("accepts the unmodified %s response", (name) => {
    const raw = recordedResponse(name);
    const answer = toCoachingAnswer(raw);
    expect(answer.id.length).toBeGreaterThan(0);
    expect(answer.text.length).toBeGreaterThan(0);
  });

  it("hydrates all seven saved assistant responses after the real API restart", async () => {
    const session = toCoachingSession(recordedResponse("restart-session"));
    const answers = new Map(names.map((name) => {
      const answer = toCoachingAnswer(recordedResponse(name));
      return [answer.id, answer];
    }));
    const load = async (id: string) => {
      const answer = answers.get(id);
      if (!answer) throw new Error("Recorded response reference is missing");
      return answer;
    };
    jest.mocked(getCoachingSession).mockResolvedValue(session);
    jest.mocked(getCoachingAnswer).mockImplementation(load);
    jest.mocked(getCoachingRecord).mockImplementation(load);
    const { result } = await renderHook(() => useCoachingChat(session.id));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toHaveLength(14);
    let restored = 0;
    session.messages.forEach((message, index) => {
      if (message.role === "assistant" && message.response) {
        expect(result.current.messages[index].answer).toEqual(answers.get(message.response.id));
        restored += 1;
      }
    });
    expect(restored).toBe(7);
  });
});
