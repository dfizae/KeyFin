import { infiniteQueryOptions, useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { getNotifications, markNotificationRead, NOTIFICATION_PAGE_SIZE } from "@/features/notification/api/notification.api";
import { markNotificationReadInPage, type InboxNotification, type NotificationPage } from "@/features/notification/model";

export const notificationKeys = {
  all: ["notification"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
};

export function notificationListQueryOptions() {
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam, signal }) => getNotifications({ cursor: pageParam, size: NOTIFICATION_PAGE_SIZE }, signal),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

/** 알림함(PAGE-28). 스크롤 끝에서 nextCursor 로 다음 쪽을 받는다 */
export function useNotifications() {
  return useInfiniteQuery(notificationListQueryOptions());
}

/** 받아 둔 쪽들을 한 목록으로 */
export function flattenNotifications(data: InfiniteData<NotificationPage> | undefined): InboxNotification[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

type NotificationListCache = InfiniteData<NotificationPage, number | null>;

/**
 * 알림을 누르면 바로 읽은 모양으로 바꾸고(낙관적 업데이트) 서버에 읽음을 보낸다 — 화면은 응답을 기다리지 않고 대상 화면으로 간다.
 * 실패하면 이전 캐시로 되돌리고, 성공·실패 모두 목록을 다시 받아 서버 상태로 맞춘다 (규칙 10).
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const queryKey = notificationKeys.list();

  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId: number) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationListCache>(queryKey);
      if (previous !== undefined) {
        queryClient.setQueryData<NotificationListCache>(queryKey, {
          ...previous,
          pages: previous.pages.map((page) => markNotificationReadInPage(page, notificationId)),
        });
      }
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
