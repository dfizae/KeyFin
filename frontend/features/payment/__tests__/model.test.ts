import {
  createFixedExpenseMock,
  deleteFixedExpenseMock,
  paymentCalendarEmptyMock,
  paymentCalendarMock,
  resetPaymentMocks,
  updateFixedExpenseMock,
} from "@/api/mocks/payment";
import { approveTransferMock, resetTransferMocks, transferListMock } from "@/api/mocks/transfer";
import {
  canApproveTransfer,
  findTransfer,
  fixedExpenseFormError,
  groupEntriesByDate,
  parseCalendarMonth,
  parseFixedExpenseRoute,
  parseTransferId,
  toFixedExpenseRequest,
  toPaymentCalendar,
  toTransfers,
  transferStatusLabel,
  upcomingEntries,
  upcomingEntry,
  type FixedExpenseForm,
} from "@/features/payment/model";
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

describe("upcomingEntries", () => {
  it("오늘 포함 이후 건을 날짜순으로 limit 건까지 준다", () => {
    const calendar = toPaymentCalendar(paymentCalendarMock(MONTH));
    const today = calendar.entries[1].date;
    const upcoming = upcomingEntries(calendar, today, 2);
    expect(upcoming.length).toBeLessThanOrEqual(2);
    expect(upcoming.every((entry) => entry.date >= today)).toBe(true);
    expect(upcomingEntries(calendar, "2026-12-31", 3)).toEqual([]);
  });
});

describe("groupEntriesByDate", () => {
  it("같은 날짜의 항목을 한 묶음으로 만든다", () => {
    const calendar = toPaymentCalendar({
      days: [
        { date: "2026-09-15", items: [
          { type: "FIXED", fixedExpenseId: 11, name: "월세", amount: 550000, prepared: true, shortage: 0 },
          { type: "FIXED", fixedExpenseId: 12, name: "관리비", amount: 90000, prepared: true, shortage: 0 },
        ] },
        { date: "2026-09-20", items: [{ type: "FIXED", fixedExpenseId: 13, name: "넷플릭스", amount: 17000, prepared: true, shortage: 0 }] },
      ],
    });

    const groups = groupEntriesByDate(calendar.entries);
    expect(groups.map((group) => [group.date, group.entries.length])).toEqual([
      ["2026-09-15", 2],
      ["2026-09-20", 1],
    ]);
    expect(groups[0].day).toBe(15);
  });
});

describe("고정지출 폼 (fixedExpenseFormError · toFixedExpenseRequest)", () => {
  const valid: FixedExpenseForm = { name: " 월세 ", expenseType: "RENT", amount: "550000", paymentDay: "15", withdrawalAccountId: 1 };

  it("빈 이름·0원·범위 밖 출금일·계좌 미선택을 막는다", () => {
    expect(fixedExpenseFormError(valid)).toBeNull();
    expect(fixedExpenseFormError({ ...valid, name: "  " })).toContain("이름");
    expect(fixedExpenseFormError({ ...valid, amount: "" })).toContain("금액");
    expect(fixedExpenseFormError({ ...valid, amount: "0" })).toContain("금액");
    expect(fixedExpenseFormError({ ...valid, paymentDay: "0" })).toContain("출금일");
    expect(fixedExpenseFormError({ ...valid, paymentDay: "32" })).toContain("출금일");
    expect(fixedExpenseFormError({ ...valid, withdrawalAccountId: null })).toContain("계좌");
  });

  it("이름을 다듬고 금액·출금일을 숫자로 바꾸며 공과금만 isVariable 을 붙인다", () => {
    expect(toFixedExpenseRequest(valid)).toEqual({
      name: "월세",
      expenseType: "RENT",
      amount: 550000,
      paymentDay: 15,
      withdrawalAccountId: 1,
    });
    expect(toFixedExpenseRequest({ ...valid, expenseType: "UTILITY" })).toMatchObject({ expenseType: "UTILITY", isVariable: true });
    expect(() => toFixedExpenseRequest({ ...valid, amount: "" })).toThrow();
  });
});

describe("parseFixedExpenseRoute · parseCalendarMonth", () => {
  it("new 는 등록, 양의 정수는 수정, 나머지는 잘못된 주소다", () => {
    expect(parseFixedExpenseRoute("new")).toEqual({ mode: "create" });
    expect(parseFixedExpenseRoute("11")).toEqual({ mode: "edit", id: 11 });
    expect(parseFixedExpenseRoute("0")).toBeNull();
    expect(parseFixedExpenseRoute("abc")).toBeNull();
    expect(parseFixedExpenseRoute(undefined)).toBeNull();
  });

  it("달 파라미터는 형식이 맞으면 그대로 쓰고 미래 달도 허용한다", () => {
    expect(parseCalendarMonth("202612", MONTH)).toBe("202612");
    expect(parseCalendarMonth("2026-12", MONTH)).toBe(MONTH);
    expect(parseCalendarMonth(undefined, MONTH)).toBe(MONTH);
  });
});

describe("고정지출 목 — 등록·수정·삭제가 캘린더에 반영된다", () => {
  afterEach(() => resetPaymentMocks());

  it("등록하면 그 달 캘린더에 새 항목이 생긴다", () => {
    const { id } = createFixedExpenseMock({ name: "헬스장", expenseType: "SUBSCRIPTION", amount: 60000, paymentDay: 5, withdrawalAccountId: 1 });
    const calendar = toPaymentCalendar(paymentCalendarMock(MONTH));
    const added = calendar.entries.find((entry) => entry.fixedExpenseId === id);

    expect(added).toMatchObject({ name: "헬스장", amount: "60000", day: 5, prepared: true });
    expect(calendar.entries[0].day).toBe(5);
  });

  it("수정은 이름·금액·출금일을 바꾸고 삭제는 목록에서 뺀다", () => {
    updateFixedExpenseMock(11, { name: "월세(인상)", expenseType: "RENT", amount: 600000, paymentDay: 16, withdrawalAccountId: 1 });
    const updated = toPaymentCalendar(paymentCalendarMock(MONTH)).entries.find((entry) => entry.fixedExpenseId === 11);
    expect(updated).toMatchObject({ name: "월세(인상)", amount: "600000", day: 16 });

    deleteFixedExpenseMock(11);
    expect(toPaymentCalendar(paymentCalendarMock(MONTH)).entries.some((entry) => entry.fixedExpenseId === 11)).toBe(false);
  });
});

describe("이체 제안 (toTransfers · findTransfer · canApproveTransfer)", () => {
  afterEach(() => resetTransferMocks());

  it("목록을 화면 모델로 바꾸고 상태를 유니온으로 옮긴다", () => {
    const transfers = toTransfers(transferListMock(MONTH));

    expect(transfers).toHaveLength(2);
    expect(transfers[0]).toMatchObject({
      id: 501,
      status: "PROPOSED",
      scheduledDate: "2026-09-15",
      requiredAmount: "230000",
      purposeName: "월세",
      executedAt: null,
      failReason: null,
    });
    expect(transfers[1]).toMatchObject({ status: "FAILED", failReason: "출금 계좌 잔액이 부족해 이체하지 못했어요." });
  });

  it("모르는 상태는 UNKNOWN 으로 흡수하고 '확인 중' 으로 적는다", () => {
    const [dto] = transferListMock(MONTH).items;
    const transfer = toTransfers({ items: [{ ...dto, status: "SETTLING" }] })[0];

    expect(transfer.status).toBe("UNKNOWN");
    expect(transferStatusLabel(transfer.status)).toBe("확인 중");
    expect(canApproveTransfer(transfer)).toBe(false);
  });

  it("승인할 수 있는 상태는 제안뿐이고, 목록에서 id 로 찾는다", () => {
    const transfers = toTransfers(transferListMock(MONTH));

    expect(canApproveTransfer(transfers[0])).toBe(true);
    expect(canApproveTransfer(transfers[1])).toBe(false);
    expect(findTransfer(transfers, 501)?.id).toBe(501);
    expect(findTransfer(transfers, 999)).toBeNull();
  });

  it("승인하면 목에서도 EXECUTED 로 남아 다시 조회할 때 결과가 보인다", () => {
    transferListMock(MONTH);
    const result = approveTransferMock(501, "2026-09-14T07:12:00");

    expect(result).toEqual({ status: "EXECUTED", executedAt: "2026-09-14T07:12:00" });
    const after = toTransfers(transferListMock(MONTH)).find((transfer) => transfer.id === 501);
    expect(after).toMatchObject({ status: "EXECUTED", executedAt: "2026-09-14T07:12:00" });
  });
});

describe("parseTransferId", () => {
  it("양의 정수만 이체 id 로 받는다 (푸시·딥링크 값은 믿지 않는다)", () => {
    expect(parseTransferId("501")).toBe(501);
    expect(parseTransferId(["502", "503"])).toBe(502);
    expect(parseTransferId("0")).toBeNull();
    expect(parseTransferId("501; DROP")).toBeNull();
    expect(parseTransferId(undefined)).toBeNull();
  });
});
