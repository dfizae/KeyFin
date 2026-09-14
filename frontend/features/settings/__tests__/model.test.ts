import { resetSettingsMocks, transferSettingsMock, updateTransferSettingsMock } from "@/api/mocks/settings";
import {
  isSettingsDirty,
  settingsFormError,
  toSettingsForm,
  toTransferSettings,
  toTransferSettingsRequest,
  type TransferSettingsForm,
} from "@/features/settings/model";
import { ContractMismatchError } from "@/lib/contract";

const settings = toTransferSettings(transferSettingsMock());

describe("toTransferSettings", () => {
  it("한도를 KRW 로 바꾸고 계약과 다른 값은 불일치로 본다", () => {
    expect(settings).toEqual({ consent: true, limitOnce: "500000", limitDaily: "1000000" });
    expect(() => toTransferSettings({ ...transferSettingsMock(), transferLimitOnce: 1.5 })).toThrow(ContractMismatchError);
  });
});

describe("settingsFormError", () => {
  const form: TransferSettingsForm = toSettingsForm(settings);

  it("동의를 켰을 때만 한도를 검사하고 1회 한도가 1일 한도를 넘으면 막는다", () => {
    expect(settingsFormError(form)).toBeNull();
    expect(settingsFormError({ ...form, limitOnce: "" })).toContain("1회 한도");
    expect(settingsFormError({ ...form, limitDaily: "0" })).toContain("1일 한도");
    expect(settingsFormError({ ...form, limitOnce: "2000000" })).toContain("1일 한도보다");
    expect(settingsFormError({ consent: false, limitOnce: "", limitDaily: "" })).toBeNull();
  });
});

describe("isSettingsDirty · toTransferSettingsRequest", () => {
  const form = toSettingsForm(settings);

  it("바뀐 값이 있을 때만 dirty 다", () => {
    expect(isSettingsDirty(form, settings)).toBe(false);
    expect(isSettingsDirty({ ...form, consent: false }, settings)).toBe(true);
    expect(isSettingsDirty({ ...form, limitOnce: "400000" }, settings)).toBe(true);
  });

  it("동의를 꺼도 한도는 서버가 들고 있어야 해서 원래 값을 그대로 보낸다", () => {
    expect(toTransferSettingsRequest({ ...form, limitOnce: "400000" }, settings)).toEqual({
      transferConsent: true,
      transferLimitOnce: 400000,
      transferLimitDaily: 1000000,
    });
    expect(toTransferSettingsRequest({ consent: false, limitOnce: "", limitDaily: "" }, settings)).toEqual({
      transferConsent: false,
      transferLimitOnce: 500000,
      transferLimitDaily: 1000000,
    });
    expect(() => toTransferSettingsRequest({ ...form, limitOnce: "0" }, settings)).toThrow();
  });
});

describe("설정 목 — 저장한 값이 다시 조회된다", () => {
  afterEach(() => resetSettingsMocks());

  it("PUT 한 값이 GET 에 그대로 나온다", () => {
    updateTransferSettingsMock({ transferConsent: false, transferLimitOnce: 300000, transferLimitDaily: 700000 });
    expect(transferSettingsMock()).toEqual({ transferConsent: false, transferLimitOnce: 300000, transferLimitDaily: 700000 });
  });
});
