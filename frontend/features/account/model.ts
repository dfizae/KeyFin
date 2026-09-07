import { isKRW, type KRW } from "@/lib/money";
import { maskAccount } from "@/lib/mask";

export type AccountSummaryDto = {
  accountId: string;
  bankName: string;
  alias: string;
  accountNumber: string;
  balance: string;
};

export type HomeSummaryDto = {
  user: { name: string };
  unreadNotificationCount: number;
  primaryAccount: AccountSummaryDto | null;
};

export type AccountSummary = {
  accountId: string;
  bankName: string;
  alias: string;
  maskedAccountNumber: string;
  balance: KRW;
};

export type HomeSummary = {
  userName: string;
  unreadNotificationCount: number;
  primaryAccount: AccountSummary | null;
};

export class ContractMismatchError extends Error {
  constructor(field: string) {
    super(`백엔드 계약 불일치: ${field}`);
    this.name = "ContractMismatchError";
  }
}

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

export function toHomeSummary(dto: HomeSummaryDto): HomeSummary {
  return {
    userName: dto.user.name,
    unreadNotificationCount: dto.unreadNotificationCount,
    primaryAccount: dto.primaryAccount ? toAccountSummary(dto.primaryAccount) : null,
  };
}
