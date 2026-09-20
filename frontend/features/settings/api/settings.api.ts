import { api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import {
  coachPersonaMock,
  notificationSettingsMock,
  transferSettingsMock,
  updateCoachPersonaMock,
  updateNotificationSettingsMock,
  updateTransferSettingsMock,
} from "@/api/mocks/settings";
import {
  toCoachPersona,
  toNotificationSettings,
  toNotificationSettingsRequest,
  toTransferSettings,
  type CoachPersona,
  type CoachPersonaDto,
  type NotificationSettings,
  type NotificationSettingsDto,
  type TransferSettings,
  type TransferSettingsDto,
} from "@/features/settings/model";

/** GET /settings/transfer — 이체 동의와 1회·1일 한도 (docs/api-contract.md USER, FR-PAY-04). 파라미터 없음 */
export async function getTransferSettings(signal?: AbortSignal): Promise<TransferSettings> {
  if (isMocked("settings")) return toTransferSettings(await withMockLatency(transferSettingsMock(), signal));
  const { data } = await api.get<TransferSettingsDto>("/settings/transfer", { signal });
  return toTransferSettings(data);
}

/** PUT /settings/transfer — 요청·응답 모두 TransferSettings. 돈이 움직이는 설정이라 자동 재시도하지 않는다 (규칙 80) */
export async function updateTransferSettings(request: TransferSettingsDto): Promise<TransferSettings> {
  if (isMocked("settings")) return toTransferSettings(await withMockLatency(updateTransferSettingsMock(request)));
  const { data } = await api.put<TransferSettingsDto>("/settings/transfer", request);
  return toTransferSettings(data);
}

/** GET /settings/notifications — 유형별 수신 여부와 방해 금지 시간 (FR-NTF-03). 오류: 404 USER_001·USER_006 */
export async function getNotificationSettings(signal?: AbortSignal): Promise<NotificationSettings> {
  if (isMocked("settings")) return toNotificationSettings(await withMockLatency(notificationSettingsMock(), signal));
  const { data } = await api.get<NotificationSettingsDto>("/settings/notifications", { signal });
  return toNotificationSettings(data);
}

/**
 * PUT /settings/notifications — 유형 4종과 방해 금지를 한 번에 보낸다(부분 수정이 없다).
 * 시작·종료를 모두 null 로 보내면 방해 금지가 풀린다. 오류: 400 COMMON_001·USER_009(방해 금지 범위) · 404 USER_001·USER_006.
 */
export async function updateNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
  const request = toNotificationSettingsRequest(settings);
  if (isMocked("settings")) return toNotificationSettings(await withMockLatency(updateNotificationSettingsMock(request)));
  const { data } = await api.put<NotificationSettingsDto>("/settings/notifications", request);
  return toNotificationSettings(data);
}

/** GET /settings/coach — 지금 고른 코치 말투 */
export async function getCoachPersona(signal?: AbortSignal): Promise<CoachPersona> {
  if (isMocked("settings")) return toCoachPersona(await withMockLatency(coachPersonaMock(), signal));
  const { data } = await api.get<CoachPersonaDto>("/settings/coach", { signal });
  return toCoachPersona(data);
}

/** PUT /settings/coach — PLAIN·DODO·ONSOON·JIBANG 중 하나. 오류: 400 COMMON_001(누락)·COMMON_002(지원하지 않는 값) */
export async function updateCoachPersona(request: CoachPersonaDto): Promise<CoachPersona> {
  if (isMocked("settings")) return toCoachPersona(await withMockLatency(updateCoachPersonaMock(request)));
  const { data } = await api.put<CoachPersonaDto>("/settings/coach", request);
  return toCoachPersona(data);
}
