import { ContractMismatchError } from "@/lib/contract";
import { formatMonthDay, formatTime, KST_LOCAL_DATE_TIME, parseKSTDateKey, parseKSTLocalDateTime, toKSTDateKey } from "@/lib/date";

/**
 * GET /notifications?unreadOnly=&cursor=&size= 계약 (백엔드 develop NotificationController, 2026-09-17 대조, FR-NTF-02).
 * 서버는 id 내림차순(최신순)으로만 정렬하고, 조회만으로 읽음 처리하지 않는다. createdAt 은 시간대 없는 KST 다.
 * requiresAction 은 읽음 처리로 바뀌지 않는다(이체를 승인해도 그대로) — 그래서 '확인 필요' 표시는 안 읽은 건에만 붙인다.
 * 모르는 type 은 UNKNOWN 으로 흡수한다 (규칙 80).
 */
export const NOTIFICATION_TYPES = ["COACHING", "BUDGET_ALERT", "TRANSFER_REQUEST", "CLEANUP", "WARNING"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number] | "UNKNOWN";

export type NotificationItemDto = {
  id: number;
  type: string;
  /** 최대 100자 */
  title: string;
  body: string | null;
  /** 이동 대상 id(최대 30자). 종류마다 뜻이 다르다 — docs/frontend-spec.md §3 푸시 딥링크 매핑 */
  refId: string | null;
  requiresAction: boolean;
  isRead: boolean;
  /** "2026-09-16T22:00:00" (KST) */
  createdAt: string;
};

export type NotificationListDto = { items: NotificationItemDto[]; nextCursor: number | null };

export type InboxNotification = {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  refId: string | null;
  requiresAction: boolean;
  isRead: boolean;
  createdAt: string;
  /** createdAt 의 날짜 "YYYY-MM-DD". 날짜 묶음 키 */
  dateKey: string;
};

export type NotificationPage = { items: InboxNotification[]; nextCursor: number | null };

function toNotificationType(raw: string): NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(raw) ? (raw as NotificationType) : "UNKNOWN";
}

export function toInboxNotification(dto: NotificationItemDto): InboxNotification {
  if (!Number.isSafeInteger(dto.id) || dto.id <= 0) throw new ContractMismatchError("items.id");
  if (!KST_LOCAL_DATE_TIME.test(dto.createdAt)) throw new ContractMismatchError("items.createdAt");
  return {
    id: dto.id,
    type: toNotificationType(dto.type),
    title: dto.title,
    body: dto.body ?? null,
    refId: dto.refId ?? null,
    requiresAction: dto.requiresAction,
    isRead: dto.isRead,
    createdAt: dto.createdAt,
    dateKey: dto.createdAt.slice(0, 10),
  };
}

export function toNotificationPage(dto: NotificationListDto): NotificationPage {
  return { items: dto.items.map(toInboxNotification), nextCursor: dto.nextCursor };
}

/** 안 읽은 조치 필요 알림. 읽고 나면 서버의 requiresAction 이 그대로여도 표시를 뗀다 */
export function needsAction(notification: InboxNotification): boolean {
  return notification.requiresAction && !notification.isRead;
}

/** 읽음 처리 낙관적 반영. 없는 id 면 같은 쪽을 그대로 돌려준다 */
export function markNotificationReadInPage(page: NotificationPage, notificationId: number): NotificationPage {
  if (!page.items.some((item) => item.id === notificationId && !item.isRead)) return page;
  return { ...page, items: page.items.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)) };
}

const HOME_ROUTE = "/";
/** 예산 탭. 뒤에 봉투 id 를 붙이면 봉투 상세(PAGE-23) */
const BUDGET_ROUTE = "/budget";
const TRANSFER_ROUTE = "/payment/transfer";
const PAYMENT_CALENDAR_ROUTE = "/payment/calendar";
const PENDING_CLEANUP_ROUTE = "/transaction/pending";

const POSITIVE_ID = /^[1-9]\d*$/;

function positiveIdOf(refId: string | null): string | null {
  return refId !== null && POSITIVE_ID.test(refId) ? refId : null;
}

/**
 * 알림을 눌렀을 때 갈 화면 (docs/frontend-spec.md §3 푸시 딥링크 매핑). refId 를 쓰는 건 이체 요청(이체 id, FR-PAY-03)과 예산 알림(봉투 id)뿐이다.
 * refId 가 없거나 id 모양이 아니면 그 종류의 목록 화면으로 보낸다(규칙 50: 파라미터는 믿지 않는다).
 * 코칭 대화(PAGE-31)가 아직 없어 COACHING 은 홈(코치 말풍선)으로 간다. 모르는 종류는 갈 곳이 없다(null).
 */
export function notificationHref(notification: Pick<InboxNotification, "type" | "refId">): string | null {
  const id = positiveIdOf(notification.refId);
  switch (notification.type) {
    case "TRANSFER_REQUEST":
      return id === null ? PAYMENT_CALENDAR_ROUTE : `${TRANSFER_ROUTE}/${id}`;
    case "BUDGET_ALERT":
      return id === null ? BUDGET_ROUTE : `${BUDGET_ROUTE}/${id}`;
    case "CLEANUP":
      return PENDING_CLEANUP_ROUTE;
    case "WARNING":
      return PAYMENT_CALENDAR_ROUTE;
    case "COACHING":
      return HOME_ROUTE;
    case "UNKNOWN":
      return null;
  }
}

export type NotificationDateGroup = { dateKey: string; notifications: InboxNotification[] };

/** 알림함은 날짜로 묶는다. 서버가 최신순으로 주므로 순서를 바꾸지 않고 이어진 같은 날짜만 모은다 */
export function groupNotificationsByDate(notifications: InboxNotification[]): NotificationDateGroup[] {
  const groups: NotificationDateGroup[] = [];
  for (const notification of notifications) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.dateKey === notification.dateKey) last.notifications.push(notification);
    else groups.push({ dateKey: notification.dateKey, notifications: [notification] });
  }
  return groups;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 날짜 묶음 제목: 오늘 · 어제 · "9월 14일 (월)" */
export function notificationDateLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "오늘";
  if (dateKey === toKSTDateKey(new Date(parseKSTDateKey(todayKey).getTime() - DAY_MS))) return "어제";
  return formatMonthDay(parseKSTDateKey(dateKey));
}

export function notificationTimeLabel(notification: InboxNotification): string {
  return formatTime(parseKSTLocalDateTime(notification.createdAt));
}
