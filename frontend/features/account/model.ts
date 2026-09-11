import type { LinkAccount, LinkCandidates } from "@/features/link/model";
import { ContractMismatchError } from "@/lib/contract";
import { isKRW, type KRW } from "@/lib/money";
import { maskAccount } from "@/lib/mask";

export type AccountSummaryDto = {
  accountId: string;
  bankName: string;
  alias: string;
  accountNumber: string;
  balance: string;
};

export type AccountSummary = {
  accountId: string;
  bankName: string;
  alias: string;
  maskedAccountNumber: string;
  balance: KRW;
};

export function toAccountSummary(dto: AccountSummaryDto): AccountSummary {
  if (!isKRW(dto.balance)) throw new ContractMismatchError("balance");
  return {
    accountId: dto.accountId,
    bankName: dto.bankName,
    alias: dto.alias,
    maskedAccountNumber: maskAccount(dto.accountNumber),
    balance: dto.balance,
  };
}

/**
 * 수입 계좌 지정(PAGE-05) 선택지. ACCOUNT 명세(GET /accounts)가 아직 없어 금융망 후보 중 연결된 계좌로 만든다.
 * 후보의 id 가 KeyFin 계좌 id 라 PUT /accounts/{id}/income 에 그대로 쓴다 (docs/api-contract.md LINK).
 */
export type IncomeAccountOption = Pick<LinkAccount, "bankCode" | "bankName" | "maskedNo" | "balance"> & {
  accountId: number;
};

export function toIncomeAccountOptions(candidates: LinkCandidates): IncomeAccountOption[] {
  return candidates.accounts
    .filter((account) => account.linked)
    .map(({ id, bankCode, bankName, maskedNo, balance }) => ({ accountId: id, bankCode, bankName, maskedNo, balance }));
}

/** 지금 목록에 있는 계좌를 골랐을 때만 지정할 수 있다. 목록을 다시 받아 사라진 계좌는 무효다 */
export function canSubmitIncomeAccount(options: readonly IncomeAccountOption[], selectedId: number | null): boolean {
  return selectedId !== null && options.some((option) => option.accountId === selectedId);
}
