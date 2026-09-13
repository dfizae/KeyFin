import { ContractMismatchError } from "@/lib/contract";
import { compareKRW, fromServerWon, toWon, type KRW } from "@/lib/money";

/**
 * GET/PUT /settings 계약 (docs/api-contract.md USER, FR-PAY-04).
 * 이체 동의와 한도는 이체 실행 직전 서버가 다시 검사하는 값이라 화면은 보내고 받은 값만 보여준다.
 */
export type TransferSettingsDto = {
  transferConsent: boolean;
  transferLimitOnce: number;
  transferLimitDaily: number;
};

export type TransferSettings = {
  consent: boolean;
  limitOnce: KRW;
  limitDaily: KRW;
};

function won(value: number, field: string): KRW {
  try {
    return fromServerWon(value);
  } catch {
    throw new ContractMismatchError(field);
  }
}

export function toTransferSettings(dto: TransferSettingsDto): TransferSettings {
  if (typeof dto.transferConsent !== "boolean") throw new ContractMismatchError("transferConsent");
  return {
    consent: dto.transferConsent,
    limitOnce: won(dto.transferLimitOnce, "transferLimitOnce"),
    limitDaily: won(dto.transferLimitDaily, "transferLimitDaily"),
  };
}

/** 설정 화면의 입력값. 금액은 입력 중 상태를 그대로 두려고 문자열이다 */
export type TransferSettingsForm = {
  consent: boolean;
  limitOnce: string;
  limitDaily: string;
};

export function toSettingsForm(settings: TransferSettings): TransferSettingsForm {
  return { consent: settings.consent, limitOnce: settings.limitOnce, limitDaily: settings.limitDaily };
}

/**
 * 저장할 수 없는 이유. 없으면 null.
 * 동의를 끄면 한도는 쓰이지 않으니 검사하지 않는다. 1회 한도가 1일 한도보다 클 수 없다는 규칙은
 * 서버 검증 문구를 아직 못 받아 화면 판단으로 둔다 (TBD).
 */
export function settingsFormError(form: TransferSettingsForm): string | null {
  if (!form.consent) return null;
  if (form.limitOnce === "" || toWon(form.limitOnce) <= 0n) return "1회 한도를 입력해 주세요.";
  if (form.limitDaily === "" || toWon(form.limitDaily) <= 0n) return "1일 한도를 입력해 주세요.";
  if (compareKRW(form.limitOnce, form.limitDaily) > 0) return "1회 한도는 1일 한도보다 클 수 없어요.";
  return null;
}

/** 바뀐 게 없으면 저장 버튼을 켜지 않는다 */
export function isSettingsDirty(form: TransferSettingsForm, settings: TransferSettings): boolean {
  return (
    form.consent !== settings.consent ||
    form.limitOnce !== settings.limitOnce ||
    form.limitDaily !== settings.limitDaily
  );
}

/** 화면 값 → PUT /settings 요청. 동의를 꺼도 한도는 서버가 들고 있어야 해서 그대로 보낸다 */
export function toTransferSettingsRequest(form: TransferSettingsForm, current: TransferSettings): TransferSettingsDto {
  const error = settingsFormError(form);
  if (error !== null) throw new Error(error);
  const limitOnce = form.consent ? form.limitOnce : current.limitOnce;
  const limitDaily = form.consent ? form.limitDaily : current.limitDaily;
  return {
    transferConsent: form.consent,
    transferLimitOnce: Number(toWon(limitOnce)),
    transferLimitDaily: Number(toWon(limitDaily)),
  };
}
