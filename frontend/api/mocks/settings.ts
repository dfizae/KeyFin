import type { TransferSettingsDto } from "@/features/settings/model";

/**
 * GET/PUT /settings 응답 예시 (docs/api-contract.md USER).
 * 서버처럼 상태를 들고 있어야 저장한 값이 다시 조회될 때 보인다.
 */
const INITIAL: TransferSettingsDto = { transferConsent: true, transferLimitOnce: 500000, transferLimitDaily: 1000000 };

let settings: TransferSettingsDto = { ...INITIAL };

export function transferSettingsMock(): TransferSettingsDto {
  return { ...settings };
}

export function updateTransferSettingsMock(request: TransferSettingsDto): TransferSettingsDto {
  settings = { ...request };
  return { ...settings };
}

/** 테스트·개발 재시작용 */
export function resetSettingsMocks(): void {
  settings = { ...INITIAL };
}
