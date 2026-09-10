import { ApiError } from "@/api/error";
import { connectFinanceMock, MOCK_FINANCE_EMAIL, MOCK_TAKEN_FINANCE_EMAIL } from "@/api/mocks/link";
import { financeErrorMessage, isRetryableFinanceError } from "@/features/link/errors";
import { canSubmitFinanceEmail, FINANCE_EMAIL_MAX_LENGTH } from "@/features/link/model";

describe("canSubmitFinanceEmail", () => {
  it("이메일 형식이고 100자 이하여야 보낼 수 있다", () => {
    expect(canSubmitFinanceEmail(MOCK_FINANCE_EMAIL)).toBe(true);
    expect(canSubmitFinanceEmail("  finance@qwer.com  ")).toBe(true);
    expect(canSubmitFinanceEmail("finance@qwer")).toBe(false);
    expect(canSubmitFinanceEmail("")).toBe(false);
  });

  it("100자를 넘으면 서버 COMMON_001 전에 막는다", () => {
    const long = `${"a".repeat(FINANCE_EMAIL_MAX_LENGTH)}@qwer.com`;
    expect(long.length).toBeGreaterThan(FINANCE_EMAIL_MAX_LENGTH);
    expect(canSubmitFinanceEmail(long)).toBe(false);
  });
});

describe("connectFinanceMock", () => {
  it("금융망에 있는 이메일이면 연결된다", () => {
    expect(connectFinanceMock({ financeEmail: MOCK_FINANCE_EMAIL })).toEqual({ connected: true });
  });

  it("없는 회원은 FINANCE_001, 이미 연결된 계정은 LINK_001 이다", () => {
    expect(() => connectFinanceMock({ financeEmail: "nobody@qwer.com" })).toThrow(ApiError);
    try {
      connectFinanceMock({ financeEmail: "nobody@qwer.com" });
    } catch (error) {
      expect((error as ApiError).code).toBe("FINANCE_001");
    }
    try {
      connectFinanceMock({ financeEmail: MOCK_TAKEN_FINANCE_EMAIL });
    } catch (error) {
      expect((error as ApiError).code).toBe("LINK_001");
      expect((error as ApiError).status).toBe(409);
    }
  });
});

describe("financeErrorMessage · isRetryableFinanceError", () => {
  it("확인된 code 는 정해진 문구를 쓰고 모르는 code 는 서버 message 를 쓴다", () => {
    expect(financeErrorMessage(new ApiError(409, "LINK_001", "무시됨"))).toContain("다른 KeyFin 계정");
    expect(financeErrorMessage(new ApiError(500, "COMMON_006", "서버 내부 오류가 발생했습니다."))).toBe(
      "서버 내부 오류가 발생했습니다."
    );
  });

  it("이미 연결됐거나 없는 회원은 다시 눌러도 소용없다", () => {
    expect(isRetryableFinanceError(new ApiError(404, "FINANCE_001", ""))).toBe(false);
    expect(isRetryableFinanceError(new ApiError(409, "LINK_001", ""))).toBe(false);
    expect(isRetryableFinanceError(new ApiError(503, "FINANCE_004", ""))).toBe(true);
  });
});
