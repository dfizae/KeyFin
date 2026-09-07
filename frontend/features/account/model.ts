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
