import { paymentCalendarEmptyMock, paymentCalendarMock } from "@/api/mocks/payment";
import { toPaymentCalendar, upcomingEntry } from "@/features/payment/model";
import { ContractMismatchError } from "@/lib/contract";

const MONTH = "202609";

describe("toPaymentCalendar", () => {
  it("날짜별 항목을 한 줄씩 펴고 금액을 KRW 로 바꾼다", () => {
    const calendar = toPaymentCalendar(paymentCalendarMock(MONTH));

    expect(calendar.entries).toHaveLength(3);
    expect(calendar.entries[0]).toMatchObject({
      date: "2026-09-15",
      day: 15,
      type: "FIXED",
      name: "월세",
      amount: "550000",
      estimated: false,
      prepared: false,
      shortage: "230000",
    });
    expect(calendar.entries[2]).toMatchObject({ day: 25, type: "CARD_BILL", estimated: true, prepared: true, shortage: "0" });
  });

  it("prepared=false 인 건수를 센다", () => {
    expect(toPaymentCalendar(paymentCalendarMock(MONTH)).shortageCount).toBe(1);
    expect(toPaymentCalendar(paymentCalendarEmptyMock).shortageCount).toBe(0);
  });

  it("날짜 순으로 정렬하고 같은 날 여러 건도 각각 키를 갖는다", () => {
    const calendar = toPaymentCalendar({
      days: [
        { date: "2026-09-20", items: [{ type: "FIXED", name: "넷플릭스", amount: 17000, prepared: true, shortage: 0 }] },
        {
          date: "2026-09-15",
          items: [
            { type: "FIXED", name: "월세", amount: 550000, prepared: false, shortage: 230000 },
            { type: "FIXED", name: "관리비", amount: 90000, prepared: true, shortage: 0 },
          ],
        },
      ],
    });

    expect(calendar.entries.map((entry) => entry.name)).toEqual(["월세", "관리비", "넷플릭스"]);
    expect(new Set(calendar.entries.map((entry) => entry.key)).size).toBe(3);
  });

  it("계약에 없는 type 은 UNKNOWN 으로 흡수한다", () => {
    const calendar = toPaymentCalendar({
      days: [{ date: "2026-09-15", items: [{ type: "LOAN", name: "대출 상환", amount: 300000, prepared: true, shortage: 0 }] }],
    });

    expect(calendar.entries[0].type).toBe("UNKNOWN");
  });

  it("날짜 형식과 금액이 계약과 다르면 ContractMismatchError 를 던진다", () => {
    expect(() =>
      toPaymentCalendar({ days: [{ date: "2026/09/15", items: [{ type: "FIXED", name: "월세", amount: 1, prepared: true, shortage: 0 }] }] })
    ).toThrow(ContractMismatchError);
    expect(() =>
      toPaymentCalendar({ days: [{ date: "2026-09-15", items: [{ type: "FIXED", name: "월세", amount: 1.5, prepared: true, shortage: 0 }] }] })
    ).toThrow(ContractMismatchError);
  });
});

describe("upcomingEntry", () => {
  const calendar = toPaymentCalendar(paymentCalendarMock(MONTH));

  it("오늘 이후 첫 건을 고르고, 출금일 당일도 포함한다", () => {
    expect(upcomingEntry(calendar, "2026-09-08")?.name).toBe("월세");
    expect(upcomingEntry(calendar, "2026-09-15")?.name).toBe("월세");
    expect(upcomingEntry(calendar, "2026-09-16")?.name).toBe("넷플릭스");
  });

  it("이번 달 출금이 다 지났으면 마지막 건을, 예정이 없으면 null 을 준다", () => {
    expect(upcomingEntry(calendar, "2026-09-30")?.name).toBe("통신비");
    expect(upcomingEntry(toPaymentCalendar(paymentCalendarEmptyMock), "2026-09-08")).toBeNull();
  });
});
