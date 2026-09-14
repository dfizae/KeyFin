/// <reference types="node" />

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { toCoachingAnswer } from "@/features/coaching/model";

// Opt-in verification of recorded, non-sensitive API responses. Raw experiment output belongs
// outside source control. CI's deterministic model/component tests do not require these files.
const fixtureDirectory = process.env.COACHING_API_FIXTURE_DIR;
const recorded = fixtureDirectory ? describe : describe.skip;
const names = ["concept", "personal-accounts", "scope-unconnected-account", "scope-non-financial",
  "history-after-cancel", "forecast-before", "risk-after"] as const;

recorded("recorded GPU API response contract", () => {
  it.each(names)("accepts the unmodified %s response", (name) => {
    if (!fixtureDirectory) throw new Error("COACHING_API_FIXTURE_DIR is required");
    const bytes = readFileSync(join(fixtureDirectory, `${name}.json`));
    const raw: unknown = JSON.parse(bytes.toString("utf8"));
    const answer = toCoachingAnswer(raw);
    expect(answer.id.length).toBeGreaterThan(0);
    expect(answer.text.length).toBeGreaterThan(0);
    // Report the exact input digest without printing financial records or credentials.
    console.info(`contract:${name}:sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  });
});
