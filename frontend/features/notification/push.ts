import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { unregisterPushDevice } from "@/features/notification/api/notification.api";
import { isInstallationId } from "@/features/notification/model";
import { loadInstallationId, saveInstallationId } from "@/lib/session-storage";

/**
 * 푸시(FCM) 기기 쪽 준비: 실행 환경 판정, 설치 UUID, 알림 채널, 토큰 (FR-NTF-01).
 * expo-notifications 는 웹·테스트 환경에서 불러오지 않도록 쓰는 순간에만 import 한다.
 */

/** 서버 FcmSender 가 이 채널 id 로 보낸다. 채널이 없으면 Android 8+ 에서 알림이 뜨지 않는다 (app.json expo-notifications defaultChannel 과 같다) */
export const PUSH_CHANNEL_ID = "default";
const PUSH_CHANNEL_NAME = "기본 알림";

/** FCM 토큰을 받을 수 있는 환경: Android 의 개발 빌드·설치 앱. 웹과 Expo Go 는 받을 수 없다(서버도 ANDROID 만 받는다) */
export function canUsePush(): boolean {
  return Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/** 이 설치의 UUID. 처음이면 암호학적 난수로 만들어 SecureStore 에 둔다 — 로그아웃해도 유지한다 */
export async function getOrCreateInstallationId(): Promise<string> {
  const saved = await loadInstallationId();
  if (isInstallationId(saved)) return saved;
  const created = Crypto.randomUUID();
  await saveInstallationId(created);
  return created;
}

export async function ensurePushChannel(): Promise<void> {
  const Notifications = await import("expo-notifications");
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: PUSH_CHANNEL_NAME,
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** 기기 FCM 토큰. Android 는 알림 권한과 무관하게 받을 수 있다(권한은 표시 여부만 정한다) */
export async function getFcmToken(): Promise<string> {
  const Notifications = await import("expo-notifications");
  const token = await Notifications.getDevicePushTokenAsync();
  return String(token.data);
}

/** FCM 이 토큰을 새로 발급하면 부른다. 반환값으로 구독을 끊는다 */
export async function subscribeFcmTokenRefresh(onToken: (token: string) => void): Promise<() => void> {
  const Notifications = await import("expo-notifications");
  const subscription = Notifications.addPushTokenListener((token) => onToken(String(token.data)));
  return () => subscription.remove();
}

/**
 * 알림 권한(Android 13+ POST_NOTIFICATIONS)을 설치마다 한 번만 묻는다. 이미 허용됐거나 다시 물을 수 없으면 묻지 않는다.
 * 물어봤는지는 호출부가 기록한다(거절한 사람에게 실행마다 다시 띄우지 않는다).
 */
export async function requestPushPermissionOnce(alreadyAsked: boolean): Promise<"asked" | "skipped"> {
  if (alreadyAsked) return "skipped";
  const Notifications = await import("expo-notifications");
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return "skipped";
  await Notifications.requestPermissionsAsync();
  return "asked";
}

/**
 * 로그아웃 직전에 부른다: 이 설치로 푸시가 가지 않게 서버에서 끊는다(Access Token 이 필요해 토큰을 지우기 전이어야 한다).
 * 실패해도 로그아웃은 막지 않는다 — 다음 로그인 때 같은 설치 UUID 로 사용자를 덮어쓴다.
 */
export async function unregisterThisDevice(): Promise<void> {
  if (!canUsePush()) return;
  try {
    const installationId = await loadInstallationId();
    if (isInstallationId(installationId)) await unregisterPushDevice(installationId);
  } catch (error) {
    reportPushSkip("기기 해제", error);
  }
}

/** 푸시 준비 실패는 사용자가 고칠 수 없어 화면에 띄우지 않는다. 개발 중에만 원인(이름·코드, 토큰 제외)을 남긴다 (규칙 50) */
export function reportPushSkip(step: string, error: unknown): void {
  if (!__DEV__) return;
  const reason = error instanceof Error ? error.name : "unknown";
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  console.warn(`[push] ${step} 건너뜀`, reason, code);
}
