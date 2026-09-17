import { infiniteQueryOptions, useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  getNotifications,
  markNotificationRead,
  NOTIFICATION_PAGE_SIZE,
  registerPushDevice,
} from "@/features/notification/api/notification.api";
import { isRetryablePushError } from "@/features/notification/errors";
import {
  markNotificationReadInPage,
  toPushDeviceRequest,
  type InboxNotification,
  type NotificationPage,
  type PushDeviceRequest,
} from "@/features/notification/model";
import {
  canUsePush,
  ensurePushChannel,
  getFcmToken,
  getOrCreateInstallationId,
  reportPushSkip,
  requestPushPermissionOnce,
  subscribeFcmTokenRefresh,
} from "@/features/notification/push";
import { loadPushPermissionAsked, savePushPermissionAsked } from "@/lib/session-storage";

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

type PushDeviceRegistration = { installationId: string; request: PushDeviceRequest };

/** 서버가 이미 3회 재시도한 뒤의 409 라 앱은 두 번까지만 더 보낸다 */
const MAX_PUSH_REGISTER_RETRY = 2;

/**
 * 로그인한 동안 이 설치를 푸시 대상으로 등록하고, FCM 이 토큰을 새로 주면 다시 등록한다 (FR-NTF-01). (app) 레이아웃이 한 번 쓴다.
 * FCM 이라는 외부 시스템과 맞추는 일이라 effect 로 둔다 (규칙 10). 등록은 멱등(PUT)이라 앱을 켤 때마다 보내도 된다.
 * 실패해도 화면을 막지 않고 다음 실행에서 다시 등록한다. 웹·Expo Go 는 토큰이 없어 아무것도 하지 않는다.
 */
export function usePushDeviceRegistration(enabled: boolean) {
  const { mutate } = useMutation({
    mutationFn: ({ installationId, request }: PushDeviceRegistration) => registerPushDevice(installationId, request),
    retry: (failureCount, error) => isRetryablePushError(error) && failureCount < MAX_PUSH_REGISTER_RETRY,
    onError: (error) => reportPushSkip("기기 등록", error),
  });

  useEffect(() => {
    if (!enabled || !canUsePush()) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const register = async (token: string) => {
      const request = toPushDeviceRequest(token);
      if (request === null || !active) return;
      mutate({ installationId: await getOrCreateInstallationId(), request });
    };

    const start = async () => {
      await ensurePushChannel();
      const stop = await subscribeFcmTokenRefresh((token) => {
        register(token).catch((error: unknown) => reportPushSkip("토큰 갱신 등록", error));
      });
      if (!active) {
        stop();
        return;
      }
      unsubscribe = stop;
      await register(await getFcmToken());
    };
    start().catch((error: unknown) => reportPushSkip("푸시 준비", error));

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [enabled, mutate]);
}

/**
 * 알림 권한(Android 13+)을 설치마다 한 번 묻는다. 탭 화면에 들어온 뒤에만 켜서 온보딩 흐름을 시스템 창으로 끊지 않는다.
 * 토큰 등록은 권한과 무관하게 먼저 해 두고, 권한은 알림을 화면에 띄울지만 정한다.
 */
export function usePushPermissionPrompt(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !canUsePush()) return;
    const ask = async () => {
      const result = await requestPushPermissionOnce(await loadPushPermissionAsked());
      if (result === "asked") await savePushPermissionAsked();
    };
    ask().catch((error: unknown) => reportPushSkip("알림 권한", error));
  }, [enabled]);
}

