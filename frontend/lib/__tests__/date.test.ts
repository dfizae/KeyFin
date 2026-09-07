import {
  InvalidDateError,
  createServerClock,
  formatDate,
  formatDateTime,
  formatMonthDay,
  formatTime,
  getKSTParts,
  parseISODate,
  toKSTDateKey,
} from "@/lib/date";

const UTC_NIGHT = "2026-08-29T20:30:15Z";

describe("parseISODate", () => {
  it("시간대가 포함된 ISO-8601만 허용한다", () => {
    expect(parseISODate(UTC_NIGHT)?.toISOString()).toBe("2026-08-29T20:30:15.000Z");
    expect(parseISODate("2026-08-30T05:30:15+09:00")?.toISOString()).toBe("2026-08-29T20:30:15.000Z");
    expect(parseISODate("2026-08-30T05:30:15.123456+0900")).not.toBeNull();
    expect(parseISODate("2026-08-29T20:30:15")).toBeNull();
    expect(parseISODate("2026-08-29")).toBeNull();
    expect(parseISODate("2026-13-01T00:00:00Z")).toBeNull();
    expect(parseISODate(1756499415000)).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
  });
});

describe("KST 변환", () => {
  it("UTC 시각을 KST(+09:00)로 바꿔 날짜가 넘어가는 경우를 처리한다", () => {
    expect(getKSTParts(UTC_NIGHT)).toEqual({
      year: 2026,
      month: 8,
      day: 30,
      hour: 5,
      minute: 30,
      second: 15,
      weekday: 0,
    });
  });

  it("표시 포맷", () => {
    expect(formatDate(UTC_NIGHT)).toBe("2026.08.30");
    expect(formatTime(UTC_NIGHT)).toBe("05:30");
    expect(formatDateTime(UTC_NIGHT)).toBe("2026.08.30 05:30");
    expect(formatMonthDay(UTC_NIGHT)).toBe("8월 30일 (일)");
    expect(toKSTDateKey(UTC_NIGHT)).toBe("2026-08-30");
  });

  it("Date 객체도 받는다", () => {
    expect(formatDate(new Date(UTC_NIGHT))).toBe("2026.08.30");
  });

  it("잘못된 값이면 InvalidDateError를 던진다", () => {
    expect(() => formatDate("어제")).toThrow(InvalidDateError);
    expect(() => formatDate(new Date(Number.NaN))).toThrow(InvalidDateError);
  });
});

describe("createServerClock", () => {
  it("응답 Date 헤더로 기기 시각 오프셋을 보정한다", () => {
    let device = Date.UTC(2026, 7, 30, 0, 0, 0);
    const clock = createServerClock(() => device);

    expect(clock.offsetMs()).toBe(0);
    clock.sync("Sun, 30 Aug 2026 00:05:00 GMT");
    expect(clock.offsetMs()).toBe(5 * 60 * 1000);
    expect(clock.now().toISOString()).toBe("2026-08-30T00:05:00.000Z");

    device += 1000;
    expect(clock.now().toISOString()).toBe("2026-08-30T00:05:01.000Z");
  });

  it("파싱할 수 없는 헤더는 무시한다", () => {
    const clock = createServerClock(() => 0);
    clock.sync("invalid");
    expect(clock.offsetMs()).toBe(0);
  });
});
