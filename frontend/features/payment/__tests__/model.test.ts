import { ApiError } from "@/api/error";
import {
  createFixedExpenseMock,
  deleteFixedExpenseMock,
  fixedExpenseListMock,
  paymentCalendarEmptyMock,
  paymentCalendarMock,
  resetPaymentMocks,
  updateFixedExpenseMock,
} from "@/api/mocks/payment";
import {
  approveTransferMock,
  postponeTransferMock,
  resetTransferMocks,
  transferDetailMock,
  transferListMock,
} from "@/api/mocks/transfer";
import {
  EMPTY_FIXED_EXPENSE_FORM,
  canApproveTransfer,
  canOpenEntry,
  canPostponeTransfer,
  findFixedExpense,
  findTransfer,
  findTransferForEntry,
  fixedExpenseFormError,
  groupEntriesByDate,
  isEditableEntry,
  parseCalendarMonth,
  parseFixedExpenseRoute,
  parseTransferId,
  paymentDayLabel,
  preparationLabel,
  splitFixedExpenses,
  toFixedExpenseForm,
  toFixedExpenseRequest,
  toFixedExpenses,
  toPaymentCalendar,
  toTransferDetail,
  toTransferPage,
  transferHistoryLabel,
  toTransfers,
  transferStatusLabel,
  upcomingEntries,
  upcomingEntry,
  type CalendarItemDto,
  type FixedExpenseDto,
  type FixedExpenseForm,
  type FixedExpenseRequest,
} from "@/features/payment/model";
import { ContractMismatchError } from "@/lib/contract";

const MONTH = "202609";

/** 계약 예시(Notion 결제 통합 일정)의 FIXED 항목. prepared·shortage 는 FR-PAY-02 전이라 null */
function item(overrides: Partial<CalendarItemDto> = {}): CalendarItemDto {
  return {
    type: "FIXED",
    fixedExpenseId: 7,
    cardId: null,
    name: "월세",
    expenseType: "RENT",
    amount: 550000,
    estimated: false,
    withdrawalAccountId: 3,
    prepared: null,
    shortage: null,
    ...overrides,
  };
}

function fixedExpenseDto(overrides: Partial<FixedExpenseDto> = {}): FixedExpenseDto {
  return {
    id: 7,
    name: "월세",
    expenseType: "RENT",
    amount: 550000,
    isVariable: false,
    paymentDay: 15,
    withdrawalAccountId: 3,
    synced: false,
    ...overrides,
  };
}

/** 목이 던진 ApiError 의 code. 안 던지면 null */
function errorCodeOf(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.code : "NOT_API_ERROR";
  }
}

describe("toPaymentCalendar", () => {
  afterEach(() => resetPaymentMocks());

  it("날짜별 항목을 한 줄씩 펴고 금액·유형·준비 상태를 화면 모델로 바꾼다", () => {
    const calendar = toPaymentCalendar(paymentCalendarMock(MONTH));

    expect(calendar.entries).toHaveLength(3);
    expect(calendar.entries[0]).toMatchObject({
      date: "2026-09-15",
      day: 15,
      type: "FIXED",
      expenseType: "RENT",
      name: "월세",
      amount: "550000",
      estimated: false,
      withdrawalAccountId: 1,
      preparation: { status: "SHORTAGE", shortage: "230000" },
    });
    expect(calendar.entries[1]).toMatchObject({
      type: "CARD_SUBSCRIPTION",
      expenseType: "SUBSCRIPTION",
      withdrawalAccountId: null,
      preparation: { status: "PREPARED" },
    });
    expect(calendar.entries[2]).toMatchObject({ day: 25, type: "FIXED", expenseType: "UTILITY", estimated: true });
    expect(calendar.shortageCount).toBe(1);
    expect(calendar.preparationKnown).toBe(true);
  });

  it("필요 금액 계산 전(prepared·shortage 가 null)이면 준비 상태를 null 로 두고 부족으로 세지 않는다", () => {
    const calendar = toPaymentCalendar({
      month: MONTH,
      days: [
        {
          date: "2026-09-15",
          items: [
            item(),
            item({ type: "CARD_SUBSCRIPTION", fixedExpenseId: 8, name: "FLO", expenseType: "SUBSCRIPTION", amount: 8900, withdrawalAccountId: null }),
          ],
        },
      ],
    });

    expect(calendar.entries.map((entry) => entry.preparation)).toEqual([null, null]);
    expect(calendar.shortageCount).toBe(0);
    expect(calendar.preparationKnown).toBe(false);
    expect(toPaymentCalendar(paymentCalendarEmptyMock)).toEqual({ entries: [], shortageCount: 0, preparationKnown: false });
  });

  it("준비 상태 문구는 준비됨·부족 금액이고 모르면 null 이다", () => {
    expect(preparationLabel({ status: "PREPARED" })).toBe("준비됨");
    expect(preparationLabel({ status: "SHORTAGE", shortage: "230000" })).toBe("부족 230,000원");
    expect(preparationLabel(null)).toBeNull();
  });

  it("날짜 순으로 정렬하고 같은 날은 서버 순서를 유지하며 각각 키를 갖는다", () => {
    const calendar = toPaymentCalendar({
      month: MONTH,
      days: [
        { date: "2026-09-20", items: [item({ name: "넷플릭스", amount: 17000 })] },
        { date: "2026-09-15", items: [item(), item({ name: "관리비", amount: 90000 })] },
      ],
    });

    expect(calendar.entries.map((entry) => entry.name)).toEqual(["월세", "관리비", "넷플릭스"]);
    expect(new Set(calendar.entries.map((entry) => entry.key)).size).toBe(3);
  });

  it("계약에 없는 type 은 UNKNOWN, 모르는 expenseType 은 null 로 흡수한다", () => {
    const calendar = toPaymentCalendar({
      month: MONTH,
      days: [{ date: "2026-09-15", items: [item({ type: "LOAN_AUTO", expenseType: "INSURANCE" })] }],
    });

    expect(calendar.entries[0]).toMatchObject({ type: "UNKNOWN", expenseType: null });
  });

  it("날짜 형식·금액이 계약과 다르거나 부족인데 부족 금액이 없으면 ContractMismatchError 를 던진다", () => {
    const withItem = (date: string, overrides: Partial<CalendarItemDto>) => () =>
      toPaymentCalendar({ month: MONTH, days: [{ date, items: [item(overrides)] }] });

    expect(withItem("2026/09/15", {})).toThrow(ContractMismatchError);
    expect(withItem("2026-09-15", { amount: 1.5 })).toThrow(ContractMismatchError);
    expect(withItem("2026-09-15", { prepared: false, shortage: null })).toThrow(ContractMismatchError);
  });
});

describe("isEditableEntry · canOpenEntry", () => {
  it("직접 등록한 고정지출만 수정할 수 있고, 동기화 구독은 읽기 전용으로 열리며, 카드 청구는 열 곳이 없다", () => {
    const [fixed, subscription, bill] = toPaymentCalendar({
      month: MONTH,
      days: [
        {
          date: "2026-09-15",
          items: [
            item(),
            item({ type: "CARD_SUBSCRIPTION", fixedExpenseId: 8, withdrawalAccountId: null }),
            item({ type: "CARD_BILL", fixedExpenseId: null, cardId: 2, name: "KB 국민카드", expenseType: "CARD_BILL", withdrawalAccountId: 3, estimated: true }),
          ],
        },
      ],
    }).entries;

    expect(isEditableEntry(fixed)).toBe(true);
    expect(isEditableEntry(subscription)).toBe(false);
    expect(isEditableEntry(bill)).toBe(false);
    expect(bill).toMatchObject({ cardId: 2, fixedExpenseId: null, estimated: true });
    expect(fixed.cardId).toBeNull();
    expect(canOpenEntry(fixed)).toBe(true);
    expect(canOpenEntry(subscription)).toBe(true);
    expect(canOpenEntry(bill)).toBe(false);
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
      month: MONTH,
      days: [
        { date: "2026-09-15", items: [item({ fixedExpenseId: 11 }), item({ fixedExpenseId: 12, name: "관리비" })] },
        { date: "2026-09-20", items: [item({ fixedExpenseId: 13, name: "넷플릭스" })] },
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

describe("고정지출 목록 (toFixedExpenses · splitFixedExpenses · paymentDayLabel)", () => {
  it("금액·유형을 화면 모델로 바꾸고, 자동 감지 카드 청구의 금액 null 과 모르는 유형은 null 로 둔다", () => {
    const expenses = toFixedExpenses([
      fixedExpenseDto(),
      fixedExpenseDto({ id: 8, name: "FLO 개인", expenseType: "SUBSCRIPTION", amount: 7900, withdrawalAccountId: null, synced: true }),
      fixedExpenseDto({ id: 9, name: "카드값", expenseType: "CARD_BILL", amount: null }),
      fixedExpenseDto({ id: 10, expenseType: "INSURANCE" }),
    ]);

    expect(expenses[0]).toEqual({
      id: 7,
      name: "월세",
      expenseType: "RENT",
      amount: "550000",
      isVariable: false,
      paymentDay: 15,
      withdrawalAccountId: 3,
      synced: false,
    });
    expect(expenses[1]).toMatchObject({ synced: true, withdrawalAccountId: null });
    expect(expenses[2].amount).toBeNull();
    expect(expenses[3].expenseType).toBeNull();
    expect(findFixedExpense(expenses, 8)?.name).toBe("FLO 개인");
    expect(findFixedExpense(expenses, 99)).toBeNull();
  });

  it("출금일이 1~31 밖이면 ContractMismatchError 를 던진다", () => {
    expect(() => toFixedExpenses([fixedExpenseDto({ paymentDay: 32 })])).toThrow(ContractMismatchError);
  });

  it("직접 등록한 항목과 동기화 항목을 서버 순서대로 나눈다", () => {
    const expenses = toFixedExpenses([
      fixedExpenseDto({ id: 7 }),
      fixedExpenseDto({ id: 8, synced: true }),
      fixedExpenseDto({ id: 9 }),
    ]);

    const { manual, synced } = splitFixedExpenses(expenses);
    expect(manual.map((expense) => expense.id)).toEqual([7, 9]);
    expect(synced.map((expense) => expense.id)).toEqual([8]);
  });

  it("29~31일은 없는 달에 말일로 나간다고 적는다", () => {
    expect(paymentDayLabel(15)).toBe("매달 15일");
    expect(paymentDayLabel(31)).toBe("매달 31일 (없는 달은 말일)");
  });
});

describe("고정지출 폼 (fixedExpenseFormError · toFixedExpenseRequest · toFixedExpenseForm)", () => {
  const valid: FixedExpenseForm = { name: " 월세 ", expenseType: "RENT", amount: "550000", paymentDay: "15", withdrawalAccountId: 1 };

  it("빈 이름·50자 초과·0원·범위 밖 출금일·계좌 미선택을 막는다", () => {
    expect(fixedExpenseFormError(valid)).toBeNull();
    expect(fixedExpenseFormError({ ...valid, name: "  " })).toContain("이름");
    expect(fixedExpenseFormError({ ...valid, name: "가".repeat(50) })).toBeNull();
    expect(fixedExpenseFormError({ ...valid, name: "가".repeat(51) })).toContain("50자");
    expect(fixedExpenseFormError({ ...valid, amount: "" })).toContain("금액");
    expect(fixedExpenseFormError({ ...valid, amount: "0" })).toContain("금액");
    expect(fixedExpenseFormError({ ...valid, paymentDay: "0" })).toContain("출금일");
    expect(fixedExpenseFormError({ ...valid, paymentDay: "32" })).toContain("출금일");
    expect(fixedExpenseFormError({ ...valid, withdrawalAccountId: null })).toContain("계좌");
    expect(fixedExpenseFormError(EMPTY_FIXED_EXPENSE_FORM)).not.toBeNull();
  });

  it("이름을 다듬고 금액·출금일을 숫자로 바꾸며, 전체 교체라 isVariable 을 늘 명시한다(공과금만 true)", () => {
    expect(toFixedExpenseRequest(valid)).toEqual({
      name: "월세",
      expenseType: "RENT",
      amount: 550000,
      isVariable: false,
      paymentDay: 15,
      withdrawalAccountId: 1,
    });
    expect(toFixedExpenseRequest({ ...valid, expenseType: "UTILITY" })).toMatchObject({ expenseType: "UTILITY", isVariable: true });
    expect(() => toFixedExpenseRequest({ ...valid, amount: "" })).toThrow();
  });

  it("수정 폼은 말일 보정 전 출금일을 그대로 채우고, 직접 등록할 수 없는 유형은 기본 유형으로 바꾼다", () => {
    const [monthEnd, bill] = toFixedExpenses([
      fixedExpenseDto({ paymentDay: 31, expenseType: "UTILITY", isVariable: true }),
      fixedExpenseDto({ id: 9, expenseType: "CARD_BILL", amount: null }),
    ]);

    expect(toFixedExpenseForm(monthEnd)).toEqual({
      name: "월세",
      expenseType: "UTILITY",
      amount: "550000",
      paymentDay: "31",
      withdrawalAccountId: 3,
    });
    expect(toFixedExpenseForm(bill)).toMatchObject({ expenseType: "SUBSCRIPTION", amount: "" });
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

describe("고정지출 목 — 서버처럼 반영하고 거절한다", () => {
  afterEach(() => resetPaymentMocks());

  const gym: FixedExpenseRequest = {
    name: "헬스장",
    expenseType: "SUBSCRIPTION",
    amount: 60000,
    isVariable: false,
    paymentDay: 5,
    withdrawalAccountId: 1,
  };

  it("등록하면 목록 끝과 그 달 캘린더에 새 항목이 생긴다", () => {
    const { id } = createFixedExpenseMock(gym);
    const calendar = toPaymentCalendar(paymentCalendarMock(MONTH));

    expect(calendar.entries.find((entry) => entry.fixedExpenseId === id)).toMatchObject({ name: "헬스장", amount: "60000", day: 5 });
    expect(calendar.entries[0].day).toBe(5);
    expect(fixedExpenseListMock().at(-1)).toMatchObject({ id, name: "헬스장", synced: false });
  });

  it("수정은 본문 전체로 바꾸고 삭제는 목록·캘린더에서 뺀다", () => {
    updateFixedExpenseMock(11, { ...gym, name: "월세(인상)", expenseType: "RENT", amount: 600000, paymentDay: 16 });
    const updated = toPaymentCalendar(paymentCalendarMock(MONTH)).entries.find((entry) => entry.fixedExpenseId === 11);
    expect(updated).toMatchObject({ name: "월세(인상)", expenseType: "RENT", amount: "600000", day: 16 });

    deleteFixedExpenseMock(11);
    expect(toPaymentCalendar(paymentCalendarMock(MONTH)).entries.some((entry) => entry.fixedExpenseId === 11)).toBe(false);
    expect(fixedExpenseListMock().some((expense) => expense.id === 11)).toBe(false);
  });

  it("동기화 항목은 409 PAY_002, 없는 항목은 404 PAY_001, 같은 내용은 409 PAY_003, 카드 청구 등록은 400 PAY_004", () => {
    expect(errorCodeOf(() => updateFixedExpenseMock(12, gym))).toBe("PAY_002");
    expect(errorCodeOf(() => deleteFixedExpenseMock(12))).toBe("PAY_002");
    expect(errorCodeOf(() => deleteFixedExpenseMock(999))).toBe("PAY_001");

    createFixedExpenseMock(gym);
    expect(errorCodeOf(() => createFixedExpenseMock(gym))).toBe("PAY_003");
    expect(errorCodeOf(() => createFixedExpenseMock({ ...gym, expenseType: "CARD_BILL" } as unknown as FixedExpenseRequest))).toBe("PAY_004");
  });

  it("출금일이 없는 달은 캘린더에서 말일로 보정하고 목록은 저장값을 그대로 준다", () => {
    const { id } = createFixedExpenseMock({ ...gym, paymentDay: 31 });

    const february = toPaymentCalendar(paymentCalendarMock("202602"));
    expect(february.entries.find((entry) => entry.fixedExpenseId === id)?.date).toBe("2026-02-28");
    expect(fixedExpenseListMock().find((expense) => expense.id === id)?.paymentDay).toBe(31);
  });
});

describe("이체 제안 (toTransfers · findTransfer · canApproveTransfer)", () => {
  afterEach(() => resetTransferMocks());

  it("목록은 최신순 커서 페이지고 status·month(출금일 기준)로 거른다", () => {
    const first = transferListMock(MONTH, {}, { cursor: null, size: 1 });
    expect(first.items.map((item) => item.id)).toEqual([502]);
    expect(first.nextCursor).toBe(502);

    const second = transferListMock(MONTH, {}, { cursor: first.nextCursor, size: 1 });
    expect(second.items.map((item) => item.id)).toEqual([501]);
    expect(second.nextCursor).toBeNull();

    expect(transferListMock(MONTH, { status: "PROPOSED" }).items.map((item) => item.id)).toEqual([501]);
    expect(transferListMock(MONTH, { month: "190001" }).items).toEqual([]);
    expect(toTransferPage(transferListMock(MONTH)).items).toHaveLength(2);
  });

  it("단건 조회는 제안과 감사 타임라인을 준다", () => {
    const failed = toTransferDetail(transferDetailMock(MONTH, 502));
    expect(failed.transfer.status).toBe("FAILED");
    expect(failed.history[0]).toMatchObject({ action: "FAIL" });
    expect(toTransferDetail({ ...transferDetailMock(MONTH, 501), history: [{ action: "REOPEN", basis: "", at: "2026-09-15T08:30:00" }] }).history[0].action).toBe("UNKNOWN");
  });

  it("배열 응답을 화면 모델로 바꾸고 출금일·목적을 함께 옮긴다", () => {
    const transfers = toTransfers(transferListMock(MONTH).items);

    expect(transfers).toHaveLength(2);
    expect(findTransfer(transfers, 501)).toMatchObject({
      id: 501,
      status: "PROPOSED",
      scheduledDate: "2026-09-14",
      dueDate: "2026-09-15",
      requiredAmount: "230000",
      purposeType: "FIXED",
      purposeName: "월세",
      purposeFixedExpenseId: 11,
      purposeCardBillingId: null,
      executedAt: null,
      failReason: null,
      createdAt: "2026-09-14T08:30:12",
    });
    expect(findTransfer(transfers, 502)).toMatchObject({
      status: "FAILED",
      purposeType: "CARD_BILL",
      purposeCardBillingId: 5,
      failReason: "출금 계좌 잔액이 부족해 이체하지 못했어요.",
    });
  });

  it("제안한 날과 대상 출금일은 다를 수 있다 — 화면 날짜는 dueDate 다", () => {
    const proposal = findTransfer(toTransfers(transferListMock(MONTH).items), 501);

    expect(proposal?.scheduledDate).not.toBe(proposal?.dueDate);
  });

  it("모르는 상태·목적은 UNKNOWN 으로 흡수하고 '확인 중' 으로 적는다", () => {
    const [dto] = transferListMock(MONTH).items;
    const transfer = toTransfers([{ ...dto, status: "SETTLING", purpose: { ...dto.purpose, type: "LOAN_REPAY" } }])[0];

    expect(transfer.status).toBe("UNKNOWN");
    expect(transfer.purposeType).toBe("UNKNOWN");
    expect(transferStatusLabel(transfer.status)).toBe("확인 중");
    expect(canApproveTransfer(transfer)).toBe(false);
  });

  it("출금일이 빠진 응답은 계약 불일치로 막는다", () => {
    const [dto] = transferListMock(MONTH).items;

    expect(() => toTransfers([{ ...dto, dueDate: "2026-09" }])).toThrow(ContractMismatchError);
  });

  it("승인은 제안·실행 중까지 열고, 연기는 제안만 받는다", () => {
    const transfers = toTransfers(transferListMock(MONTH).items);
    const proposed = findTransfer(transfers, 501);
    const failed = findTransfer(transfers, 502);
    const approved = toTransfers([{ ...transferListMock(MONTH).items[0], status: "APPROVED" }])[0];

    expect(canApproveTransfer(proposed!)).toBe(true);
    expect(canPostponeTransfer(proposed!)).toBe(true);
    // 금융망 응답이 유실된 건이라 같은 번호로 재시도할 수 있다. 연기는 409 라 막는다.
    expect(canApproveTransfer(approved)).toBe(true);
    expect(canPostponeTransfer(approved)).toBe(false);
    expect(canApproveTransfer(failed!)).toBe(false);
    expect(findTransfer(transfers, 999)).toBeNull();
  });

  it("승인하면 목에서도 EXECUTED 로 남아 다시 조회할 때 결과가 보인다", () => {
    transferListMock(MONTH);
    const result = approveTransferMock(501, "2026-09-14T07:12:00");

    expect(result).toEqual({ id: 501, status: "EXECUTED", executedAt: "2026-09-14T07:12:00", failReason: null });
    const after = findTransfer(toTransfers(transferListMock(MONTH).items), 501);
    expect(after).toMatchObject({ status: "EXECUTED", executedAt: "2026-09-14T07:12:00" });
  });

  it("승인·연기는 서버처럼 감사 기록을 오래된 순으로 쌓는다", () => {
    transferListMock(MONTH);
    postponeTransferMock(501, "2026-09-14T07:12:30");
    approveTransferMock(501, "2026-09-14T07:13:00");

    const { history } = toTransferDetail(transferDetailMock(MONTH, 501));
    expect(history.map((entry) => entry.action)).toEqual(["HOLD", "EXECUTE"]);
    expect(history[0].basis).toContain("사용자 보류(나중에)");
    expect(history[1].basis).toContain("기관거래고유번호");
  });

  it("감사 종류는 우리말 제목으로 적고 모르는 값은 '기록' 으로 흡수한다", () => {
    expect(transferHistoryLabel("EXECUTE")).toBe("이체 완료");
    expect(transferHistoryLabel("HOLD")).toBe("보류");
    expect(transferHistoryLabel("UNKNOWN")).toBe("기록");
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

describe("findTransferForEntry — 캘린더 부족 뱃지에서 이체 제안으로", () => {
  afterEach(() => {
    resetPaymentMocks();
    resetTransferMocks();
  });

  const entries = () => toPaymentCalendar(paymentCalendarMock(MONTH)).entries;
  const rent = () => entries().find((entry) => entry.name === "월세")!;
  const proposal = () => findTransfer(toTransfers(transferListMock(MONTH).items), 501)!;

  it("부족한 고정지출은 fixedExpenseId 와 출금일이 같은 제안으로 잇는다", () => {
    const transfers = toTransfers(transferListMock(MONTH).items);

    expect(findTransferForEntry(transfers, rent())?.id).toBe(501);
    expect(findTransferForEntry(transfers, entries().find((entry) => entry.name === "통신비")!)).toBeNull();
  });

  it("출금일이 다르거나 이미 끝난 제안은 잇지 않고, 실행 중(APPROVED)은 재시도하러 잇는다", () => {
    const base = proposal();

    expect(findTransferForEntry([{ ...base, dueDate: `${MONTH.slice(0, 4)}-${MONTH.slice(4)}-16` }], rent())).toBeNull();
    expect(findTransferForEntry([{ ...base, status: "EXECUTED" }], rent())).toBeNull();
    expect(findTransferForEntry([{ ...base, status: "APPROVED" }], rent())?.id).toBe(501);
  });

  it("카드 청구는 cardBillingId 가 캘린더에 없어 출금일·출금 계좌·카드명으로 잇는다", () => {
    const bill = { ...rent(), type: "CARD_BILL" as const, fixedExpenseId: null, cardId: 2, name: "KB 국민카드" };
    const transfer = { ...proposal(), purposeType: "CARD_BILL" as const, purposeFixedExpenseId: null, purposeCardBillingId: 5, purposeName: "KB 국민카드" };

    expect(findTransferForEntry([transfer], bill)?.id).toBe(501);
    expect(findTransferForEntry([{ ...transfer, purposeName: "신한카드" }], bill)).toBeNull();
    expect(findTransferForEntry([{ ...transfer, toAccountId: 9 }], bill)).toBeNull();
  });
});
