import { toCoachingAnswer, toCoachingSession } from "@/features/coaching/model";

const concept = {
  id: "answer-1", answer_type: "finance_education", status: "answered", text: "일반 금융 설명",
  wording_source: "llm", model: "test", fallback_reason: null, created_at: 1,
  evidence: { references: [{ id: "reference-1", title: "공식 자료", url: "https://www.bok.or.kr/example" }] },
};

describe("coaching response boundary", () => {
  it("preserves source references when a concept answer has no receipt", () => {
    // Given / When: a non-prediction response from the authenticated proxy.
    const answer = toCoachingAnswer(concept);
    // Then: its source and state stay separate from financial predictions.
    expect(answer.kind).toBe("chat");
    expect(answer.references).toHaveLength(1);
    expect(answer.status).toBe("answered");
  });

  it("keeps the exact FDT date window when a prediction arrives", () => {
    const answer = toCoachingAnswer({
      id: "forecast-1", text: "예상 잔액", wording_source: "llm", model: "test", fallback_reason: null, created_at: 2,
      receipt: { identity: { as_of: "2026-09-03" }, numeric_result: { mode: "forecast", status: "partial" },
        period: { contract_version: "coaching-period/1", kind: "month_end", source: "question",
          reference_date: "2026-09-03", reference_state: "day_close_observed", window_start: "2026-09-01",
          window_end: "2026-09-30", window_calendar_days: 30, forecast_start: "2026-09-04", forecast_end: "2026-09-30",
          forecast_days: 27, reference_in_window: true, budget_month_start: "2026-09-01", budget_month_end: "2026-09-30",
          budget_forecast_end: "2026-09-30", budget_future_coverage_complete: true, calendar: "gregorian",
          time_zone: "Asia/Seoul", holiday_adjustment: "none", lunar_calendar_supported: false } },
    });
    expect(answer.kind).toBe("coaching");
    expect(answer.status).toBe("partial");
    expect(answer.period).toEqual({ start: "2026-09-04", end: "2026-09-30", asOf: "2026-09-03" });
  });

  it("does not label payment coaching or insufficient numeric data as successful forecasting", () => {
    const base = { id: "coaching-1", text: "자료가 필요해요", wording_source: "template", model: "test", fallback_reason: null, created_at: 2 };
    const payment = toCoachingAnswer({ ...base, receipt: { identity: { as_of: "2026-09-03" }, payment: { amount_krw: 5000 } } });
    expect(payment.kind).toBe("coaching");
    expect(payment.period).toBeNull();
    const missing = toCoachingAnswer({ ...base, receipt: { identity: { as_of: "2026-09-03" },
      numeric_result: { mode: "forecast", status: "insufficient_data" },
      period: { forecast_start: "2026-09-04", forecast_end: "2026-09-30" } } });
    expect(missing.status).toBe("needs_data");
    expect(missing.period).toBeNull();
  });

  it("accepts a personal summary without pretending it has a source catalog", () => {
    const answer = toCoachingAnswer({ ...concept, answer_type: "personal_context", evidence: { coverage: "partial", rows: [] } });
    expect(answer.references).toEqual([]);
  });

  it("rejects a script URL instead of rendering an unsafe source link", () => {
    const invalid = { ...concept, evidence: { references: [{ id: "x", title: "x", url: "javascript:alert(1)" }] } };
    expect(() => toCoachingAnswer(invalid)).toThrow();
  });

  it("accepts an empty session without prior coaching", () => {
    const session = toCoachingSession({ id: "session-1", coaching_id: null, created_at: 1, expires_at: 2, messages: [] });
    expect(session.messages).toEqual([]);
  });

  it("rejects unknown statuses rather than showing them as answered", () => {
    expect(() => toCoachingAnswer({ ...concept, status: "invented" })).toThrow();
  });
});
