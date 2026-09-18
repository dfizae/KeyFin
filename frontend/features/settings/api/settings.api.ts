import { api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { transferSettingsMock, updateTransferSettingsMock } from "@/api/mocks/settings";
import { toTransferSettings, type TransferSettings, type TransferSettingsDto } from "@/features/settings/model";

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
