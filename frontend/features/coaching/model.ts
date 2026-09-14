import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9_.-]{1,120}$/);
const reference = z.object({ id: z.string(), title: z.string(), url: z.url().regex(/^https:\/\//) });
const status = z.enum(["answered", "needs_source", "needs_data", "out_of_scope", "unavailable", "needs_clarification"]);
const common = {
  id: identifier, text: z.string(), wording_source: z.enum(["llm", "template", "engine"]),
  model: z.string(), fallback_reason: z.string().nullable(), created_at: z.number(),
};
const chat = z.object({
  ...common,
  answer_type: z.enum(["finance_education", "spending_history", "personal_context", "data_request", "scope_response"]),
  status,
  evidence: z.object({ references: z.array(reference).optional() }).passthrough(),
});
const date = z.iso.date();
const coaching = z.object({
  ...common,
  receipt: z.object({
    identity: z.object({ as_of: date }).passthrough(),
    period: z.object({ forecast_start: date, forecast_end: date }).passthrough().nullable().optional(),
    numeric_result: z.object({ mode: z.enum(["forecast", "risk", "goal", "what_if", "optimize"]),
      status: z.enum(["ok", "partial", "insufficient_data"]) }).passthrough().nullable().optional(),
  }).passthrough(),
});
const session = z.object({
  id: identifier, coaching_id: identifier.nullable(), created_at: z.number(), expires_at: z.number(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string(),
    response: z.object({ kind: z.enum(["chat", "coaching"]), id: identifier }).nullable().optional() })),
});

export type CoachingAnswer = {
  readonly id: string;
  readonly kind: "chat" | "coaching";
  readonly status: z.infer<typeof status> | "partial";
  readonly text: string;
  readonly references: readonly z.infer<typeof reference>[];
  readonly period: { readonly start: string; readonly end: string; readonly asOf: string } | null;
  readonly fallback: boolean;
};
export type CoachingSession = z.infer<typeof session>;

/** Parse the union once at the HTTP boundary. Unknown statuses cannot masquerade as success. */
export function toCoachingAnswer(value: unknown): CoachingAnswer {
  const result = z.union([chat, coaching]).parse(value);
  if ("answer_type" in result) {
    return { id: result.id, kind: "chat", status: result.status, text: result.text,
      references: result.evidence.references ?? [], period: null, fallback: result.fallback_reason !== null };
  }
  const period = result.receipt.period;
  const numeric = result.receipt.numeric_result;
  const numericStatus = numeric?.status === "insufficient_data" ? "needs_data" : numeric?.status === "partial" ? "partial" : "answered";
  return { id: result.id, kind: "coaching", status: numericStatus, text: result.text, references: [],
    fallback: result.fallback_reason !== null,
    // A calendar window can include observed days. Only these engine fields delimit future days.
    period: period && numeric && numericStatus !== "needs_data"
      ? { start: period.forecast_start, end: period.forecast_end, asOf: result.receipt.identity.as_of } : null };
}

export function toCoachingSession(value: unknown): CoachingSession { return session.parse(value); }
export function parseCoachingId(value: string): string { return identifier.parse(value); }

const notification = z.object({ event_id: identifier, type: z.literal("COACHING"), coaching_id: identifier,
  text: z.string(), created_at: z.number(), acknowledged: z.boolean() });
export type CoachingNotification = z.infer<typeof notification>;
export function toCoachingNotifications(value: unknown): readonly CoachingNotification[] {
  return z.object({ items: z.array(notification) }).parse(value).items;
}
export function toCoachingNotification(value: unknown): CoachingNotification { return notification.parse(value); }

export const ANSWER_STATUS_LABELS = {
  answered: "답변", needs_source: "출처 확인 필요", needs_data: "자료 확인 필요",
  out_of_scope: "금융 질문 안내", unavailable: "일시적으로 답변할 수 없음", needs_clarification: "질문 확인 필요",
  partial: "일부 자료 기준 코칭",
} as const;
