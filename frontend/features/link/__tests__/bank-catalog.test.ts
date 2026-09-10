import { BANK_CATALOG, bankInitial, bankLogo } from "@/features/link/bank-catalog";

describe("BANK_CATALOG", () => {
  it("금융망 은행 코드 18개를 담는다", () => {
    expect(BANK_CATALOG).toHaveLength(18);
    expect(new Set(BANK_CATALOG.map((bank) => bank.code)).size).toBe(18);
  });

  it("한국은행·싸피은행 말고는 모두 로고가 있다", () => {
    const withoutLogo = BANK_CATALOG.filter((bank) => bank.logo === undefined).map((bank) => bank.code);
    expect(withoutLogo).toEqual(["001", "999"]);
  });

  it("킷에서 심볼을 함께 쓰는 은행은 같은 로고를 가리킨다", () => {
    expect(bankLogo("034")).toBe(bankLogo("037")); // 광주 · 전북
    expect(bankLogo("088")).toBe(bankLogo("035")); // 신한 · 제주
  });
});

describe("bankLogo · bankInitial", () => {
  it("모르는 코드는 로고가 없고 이름 첫 글자를 쓴다", () => {
    expect(bankLogo("777")).toBeUndefined();
    expect(bankInitial("싸피은행")).toBe("싸");
    expect(bankInitial("  ")).toBe("은");
  });
});
