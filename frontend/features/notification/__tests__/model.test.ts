import { ApiError } from "@/api/error";
import { markNotificationReadMock, notificationListMock, resetNotificationMocks } from "@/api/mocks/notification";
import {
  groupNotificationsByDate,
  markNotificationReadInPage,
  needsAction,
  notificationDateLabel,
  notificationHref,
  notificationTimeLabel,
  toInboxNotification,
  toNotificationPage,
  type NotificationItemDto,
} from "@/features/notification/model";
import { ContractMismatchError } from "@/lib/contract";

const TODAY = "2026-09-17";

/** 계약 예시(Swagger NotificationControllerDocs)의 이체 승인 요청 */
function dto(overrides: Partial<NotificationItemDto> = {}): NotificationItemDto {
  return {
    id: 123,
    type: "TRANSFER_REQUEST",
    title: "이체 승인 요청",
    body: "확인이 필요한 이체 요청이 있습니다.",
    refId: "456",
    requiresAction: true,
    isRead: false,
    createdAt: "2026-09-16T22:00:00",
    ...overrides,
  };
}

describe("toNotificationPage", () => {
  it("계약 예시를 화면 모델로 옮기고 날짜 키를 붙인다", () => {
    const page = toNotificationPage({ items: [dto()], nextCursor: null });

    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({ id: 123, type: "TRANSFER_REQUEST", refId: "456", dateKey: "2026-09-16" });
    expect(notificationTimeLabel(page.items[0])).toBe("22:00");
  });

  it("모르는 종류는 UNKNOWN 으로 흡수하고, 본문·refId 는 null 을 허용한다", () => {
    expect(toInboxNotification(dto({ type: "PROMOTION", body: null, refId: null }))).toMatchObject({
      type: "UNKNOWN",
      body: null,
      refId: null,
    });
  });

  it("id·createdAt 형식이 틀리면 계약 불일치다", () => {
    expect(() => toInboxNotification(dto({ id: 0 }))).toThrow(ContractMismatchError);
    expect(() => toInboxNotification(dto({ createdAt: "2026-09-16T22:00:00+09:00" }))).toThrow(ContractMismatchError);
  });
});

describe("notificationHref — 종류별 이동 (frontend-spec §3)", () => {
  it("refId 가 id 면 그 대상 화면으로 간다", () => {
    expect(notificationHref({ type: "TRANSFER_REQUEST", refId: "501" })).toBe("/payment/transfer/501");
    expect(notificationHref({ type: "BUDGET_ALERT", refId: "1" })).toBe("/budget/1");
    expect(notificationHref({ type: "CLEANUP", refId: null })).toBe("/transaction/pending");
    expect(notificationHref({ type: "WARNING", refId: "11" })).toBe("/payment/calendar");
    expect(notificationHref({ type: "COACHING", refId: "31" })).toBe("/");
  });

  it("refId 가 없거나 id 모양이 아니면 목록 화면으로, 모르는 종류는 갈 곳이 없다", () => {
    expect(notificationHref({ type: "TRANSFER_REQUEST", refId: null })).toBe("/payment/calendar");
    expect(notificationHref({ type: "TRANSFER_REQUEST", refId: "../settings" })).toBe("/payment/calendar");
    expect(notificationHref({ type: "BUDGET_ALERT", refId: "0" })).toBe("/budget");
    expect(notificationHref({ type: "UNKNOWN", refId: "1" })).toBeNull();
  });
});

describe("읽음 상태", () => {
  it("'확인 필요' 는 안 읽은 조치 필요 건에만 붙는다 — 서버가 requiresAction 을 풀지 않아도 읽으면 뗀다", () => {
    expect(needsAction(toInboxNotification(dto()))).toBe(true);
    expect(needsAction(toInboxNotification(dto({ isRead: true })))).toBe(false);
    expect(needsAction(toInboxNotification(dto({ requiresAction: false })))).toBe(false);
  });

  it("낙관적 읽음 반영은 해당 알림만 바꾸고, 바꿀 게 없으면 같은 쪽을 돌려준다", () => {
    const page = toNotificationPage({ items: [dto({ id: 2 }), dto({ id: 1, isRead: true })], nextCursor: null });
    const read = markNotificationReadInPage(page, 2);

    expect(read.items.map((item) => item.isRead)).toEqual([true, true]);
    expect(page.items[0].isRead).toBe(false);
    expect(markNotificationReadInPage(page, 1)).toBe(page);
    expect(markNotificationReadInPage(page, 999)).toBe(page);
  });
});

describe("날짜 묶음", () => {
  it("서버 순서(최신순)를 유지하며 이어진 같은 날짜만 묶는다", () => {
    const items = [
      dto({ id: 5, createdAt: "2026-09-17T12:40:00" }),
      dto({ id: 4, createdAt: "2026-09-17T07:00:00" }),
      dto({ id: 3, createdAt: "2026-09-16T21:00:00" }),
    ].map(toInboxNotification);

    expect(groupNotificationsByDate(items).map((group) => [group.dateKey, group.notifications.map((n) => n.id)])).toEqual([
      ["2026-09-17", [5, 4]],
      ["2026-09-16", [3]],
    ]);
  });

  it("제목은 오늘 · 어제 · 월일(요일)이고, 달이 바뀌어도 어제를 맞춘다", () => {
    expect(notificationDateLabel(TODAY, TODAY)).toBe("오늘");
    expect(notificationDateLabel("2026-09-16", TODAY)).toBe("어제");
    expect(notificationDateLabel("2026-09-14", TODAY)).toBe("9월 14일 (월)");
    expect(notificationDateLabel("2026-08-31", "2026-09-01")).toBe("어제");
  });
});

describe("알림 목 — 서버처럼 쪽을 나누고 읽음을 기억한다", () => {
  beforeEach(() => resetNotificationMocks(TODAY));

  it("최신순 20건씩, 마지막 쪽은 nextCursor 가 null 이다", () => {
    const first = notificationListMock({ cursor: null, size: 20 });
    const second = notificationListMock({ cursor: first.nextCursor, size: 20 });

    expect(first.items).toHaveLength(20);
    expect(first.items[0]).toMatchObject({ type: "BUDGET_ALERT", isRead: false, createdAt: "2026-09-17T12:40:00" });
    expect(first.items[1]).toMatchObject({ type: "TRANSFER_REQUEST", refId: "501", requiresAction: true });
    expect(second.items).toHaveLength(7);
    expect(second.nextCursor).toBeNull();
    expect(Math.min(...first.items.map((item) => item.id))).toBeGreaterThan(Math.max(...second.items.map((item) => item.id)));
  });

  it("읽음 처리는 다시 조회해도 남고, 이미 읽은 알림도 성공이며, 없는 id 는 404 NOTI_001 이다", () => {
    const [latest] = notificationListMock({ cursor: null, size: 1 }).items;

    markNotificationReadMock(latest.id);
    markNotificationReadMock(latest.id);
    expect(notificationListMock({ cursor: null, size: 1 }).items[0].isRead).toBe(true);

    let code: string | null = null;
    try {
      markNotificationReadMock(9999);
    } catch (error) {
      code = error instanceof ApiError ? error.code : null;
    }
    expect(code).toBe("NOTI_001");
  });
});
