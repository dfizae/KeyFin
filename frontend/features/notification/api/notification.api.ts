import { api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { markNotificationReadMock, notificationListMock } from "@/api/mocks/notification";
import { toNotificationPage, type NotificationListDto, type NotificationPage } from "@/features/notification/model";

export type NotificationPageParams = { cursor: number | null; size: number };

/** 계약 기본값(size 20)과 같다 */
export const NOTIFICATION_PAGE_SIZE = 20;

/**
 * GET /notifications?cursor=&size= — 본인 알림, 최신순 커서 페이지 (FR-NTF-02).
 * unreadOnly 는 보내지 않는다(알림함은 읽은 것도 함께 보여 준다). 조회만으로 읽음 처리되지 않는다.
 */
export async function getNotifications(page: NotificationPageParams, signal?: AbortSignal): Promise<NotificationPage> {
  if (isMocked("notification")) return toNotificationPage(await withMockLatency(notificationListMock(page), signal));
  const { data } = await api.get<NotificationListDto>("/notifications", {
    params: { cursor: page.cursor ?? undefined, size: page.size },
    signal,
  });
  return toNotificationPage(data);
}

/**
 * PATCH /notifications/{id}/read — 본문 없음, data 는 null. 이미 읽은 알림도 성공(멱등).
 * 남의 알림·없는 알림은 404 NOTI_001. 이체 승인·조치 필요 여부는 바꾸지 않는다.
 */
export async function markNotificationRead(notificationId: number): Promise<void> {
  if (isMocked("notification")) {
    markNotificationReadMock(notificationId);
    await withMockLatency(undefined);
    return;
  }
  await api.patch(`/notifications/${notificationId}/read`);
}
