import { ContractMismatchError } from "@/lib/contract";
import { formatDateGroupLabel, formatTime, KST_LOCAL_DATE_TIME, parseKSTLocalDateTime } from "@/lib/date";

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
/** 뒤에 거래 id 를 붙이면 거래 상세(PAGE-21, 분류·태그 수정 진입점) */
const TRANSACTION_ROUTE = "/transaction";
const LINKS_ROUTE = "/my/links";
const COIN_ROUTE = "/coin";

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

/** 날짜 묶음 제목: 오늘 · 어제 · "9월 14일 (월)" (코인 이력과 같은 규칙, lib/date) */
export function notificationDateLabel(dateKey: string, todayKey: string): string {
  return formatDateGroupLabel(dateKey, todayKey);
}

export function notificationTimeLabel(notification: InboxNotification): string {
  return formatTime(parseKSTLocalDateTime(notification.createdAt));
}

/* ───────────── 서버 계약: PUT·DELETE /me/push-devices/{installationId} (백엔드 develop PushDeviceController, 2026-09-17 대조) ───────────── */

/** 서버가 받는 플랫폼은 ANDROID 하나다(정규식 검증) */
export const PUSH_PLATFORM = "ANDROID";

/** PUT 본문. Notion 행의 `{ fcmToken }` 이 아니라 배포 코드의 `{ token, platform }` 을 따른다 */
export type PushDeviceRequest = { token: string; platform: typeof PUSH_PLATFORM };

const INSTALLATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 설치 UUID 인지. 서버는 하이픈 있는 표준 36자만 받는다(대소문자 무관) */
export function isInstallationId(value: string | null): value is string {
  return value !== null && INSTALLATION_ID.test(value);
}

/** 서버 검증과 같다: 공백 없는 출력 가능 ASCII(0x21~0x7E), 1~2048자 */
const FCM_TOKEN = /^[!-~]{1,2048}$/;

/** FCM 토큰을 등록 요청으로. 서버가 400 으로 거절할 모양이면 보내지 않도록 null 이다 */
export function toPushDeviceRequest(token: unknown): PushDeviceRequest | null {
  return typeof token === "string" && FCM_TOKEN.test(token) ? { token, platform: PUSH_PLATFORM } : null;
}

/* ───────────── FCM data 메시지 규약 (Notion 「FCM data 메시지 규약」 — 발송 코드가 없어 코드 대조는 못 했다, api-contract NOTIFICATION) ───────────── */

/**
 * 푸시 data.type 9종. 알림함 type(5종)과 이름이 다르다 — 미납 경고가 알림함은 WARNING, 푸시는 PAYMENT_RISK 이고
 * CLASSIFY_QUESTION·REACTION·NEW_LINK_FOUND·COIN_GRANTED 는 푸시에만 있다.
 */
export const PUSH_DATA_TYPES = [
  "CLASSIFY_QUESTION",
  "BUDGET_ALERT",
  "TRANSFER_REQUEST",
  "COACHING",
  "REACTION",
  "CLEANUP",
  "NEW_LINK_FOUND",
  "PAYMENT_RISK",
  "COIN_GRANTED",
] as const;

export type PushDataType = (typeof PUSH_DATA_TYPES)[number] | "UNKNOWN";

/** 푸시 data 는 서버가 Map<string,string> 으로 보내지만 밖에서 온 값이라 모양을 확인하고 쓴다 (규칙 50). 모르는 종류는 UNKNOWN 으로 흡수한다 (규칙 90) */
export function toPushDataType(data: unknown): PushDataType {
  if (typeof data !== "object" || data === null) return "UNKNOWN";
  const raw = (data as Record<string, unknown>).type;
  return typeof raw === "string" && (PUSH_DATA_TYPES as readonly string[]).includes(raw) ? (raw as PushDataType) : "UNKNOWN";
}

/**
 * 앱을 보고 있는 동안 OS 배너로 띄울 종류 (FR-NTF-01, 2026-09-20 사용자 결정).
 * 방 캐릭터 연출(REACTION)과 코인 지급(COIN_GRANTED)은 방에서 바로 보이므로 배너 없이 데이터만 새로 받는다.
 * 모르는 종류는 띄운다 — 서버가 종류를 늘렸을 때 사용자가 알림을 놓치지 않는 쪽이 안전하다.
 */
export function shouldShowPushBanner(type: PushDataType): boolean {
  return type !== "REACTION" && type !== "COIN_GRANTED";
}

/** 푸시 data 의 id 값. 서버가 Map<string,string> 으로 보내므로 문자열 양수 id 일 때만 쓴다 (규칙 50: 딥링크 값은 믿지 않는다) */
function pushIdOf(data: unknown, field: string): string | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = (data as Record<string, unknown>)[field];
  return typeof raw === "string" && POSITIVE_ID.test(raw) ? raw : null;
}

/**
 * 푸시를 탭했을 때 갈 화면 (FR-NTF-01, docs/frontend-spec.md §3). 알림함의 notificationHref 와 종류 이름·id 필드가 달라 따로 둔다 —
 * 미납 경고가 푸시는 PAYMENT_RISK 이고, 푸시에만 있는 4종(CLASSIFY_QUESTION·REACTION·NEW_LINK_FOUND·COIN_GRANTED)의 진입 화면은 2026-09-20 사용자 결정이다.
 * id 가 없거나 모양이 아니면 그 종류의 목록 화면으로 보내고, 모르는 종류는 갈 곳이 없어 앱만 열린다(null).
 * PAYMENT_RISK 는 fixedExpenseId 가 와도 알림함 WARNING 과 같은 캘린더로 보내 도착지를 하나로 둔다.
 */
export function pushNotificationHref(data: unknown): string | null {
  switch (toPushDataType(data)) {
    case "TRANSFER_REQUEST": {
      const id = pushIdOf(data, "transferId");
      return id === null ? PAYMENT_CALENDAR_ROUTE : `${TRANSFER_ROUTE}/${id}`;
    }
    case "BUDGET_ALERT": {
      const id = pushIdOf(data, "envelopeId");
      return id === null ? BUDGET_ROUTE : `${BUDGET_ROUTE}/${id}`;
    }
    case "CLASSIFY_QUESTION": {
      const id = pushIdOf(data, "transactionId");
      return id === null ? PENDING_CLEANUP_ROUTE : `${TRANSACTION_ROUTE}/${id}`;
    }
    case "CLEANUP":
      return PENDING_CLEANUP_ROUTE;
    case "PAYMENT_RISK":
      return PAYMENT_CALENDAR_ROUTE;
    case "NEW_LINK_FOUND":
      return LINKS_ROUTE;
    case "COIN_GRANTED":
      return COIN_ROUTE;
    case "COACHING":
    case "REACTION":
      return HOME_ROUTE;
    case "UNKNOWN":
      return null;
  }
}
