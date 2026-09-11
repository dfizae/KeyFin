import type { LinkAccount, LinkCandidates, LinkCard } from "@/features/link/model";
import { ContractMismatchError } from "@/lib/contract";
import { addKRW, isKRW, type KRW } from "@/lib/money";
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
 * 연결된(관리 중) 계좌. ACCOUNT 명세(GET /accounts)가 아직 없어 금융망 후보 중 managed 계좌로 만든다.
 * 후보의 id 가 KeyFin 계좌 id 라 PUT /accounts/{id}/income·거래 필터(accountId)에 그대로 쓴다 (docs/api-contract.md LINK).
 */
export type LinkedAccount = Pick<LinkAccount, "bankCode" | "bankName" | "maskedNo" | "balance"> & {
  accountId: number;
};

export function linkedAccounts(candidates: LinkCandidates): LinkedAccount[] {
  return candidates.accounts
    .filter((account) => account.linked)
    .map(({ id, bankCode, bankName, maskedNo, balance }) => ({ accountId: id, bankCode, bankName, maskedNo, balance }));
}

/** 수입 계좌 지정(PAGE-05) 선택지 = 연결된 계좌 */
export type IncomeAccountOption = LinkedAccount;

export function toIncomeAccountOptions(candidates: LinkCandidates): IncomeAccountOption[] {
  return linkedAccounts(candidates);
}

/** 연결된 카드. 후보의 id 가 KeyFin 카드 id 라 거래 필터(cardId)에 그대로 쓴다 */
export type LinkedCard = Pick<LinkCard, "issuerName" | "cardName" | "maskedNo"> & { cardId: number };

export function linkedCards(candidates: LinkCandidates): LinkedCard[] {
  return candidates.cards
    .filter((card) => card.linked)
    .map(({ id, issuerName, cardName, maskedNo }) => ({ cardId: id, issuerName, cardName, maskedNo }));
}

/** 자산 탭 "내 총 자산" = 연결 계좌 잔액 합계. 카드는 잔액이 없어 뺀다. 잔액은 금융망 실시간 값이다 */
export function totalBalance(accounts: readonly LinkedAccount[]): KRW {
  return accounts.length === 0 ? "0" : addKRW(...accounts.map((account) => account.balance));
}

/** 지금 목록에 있는 계좌를 골랐을 때만 지정할 수 있다. 목록을 다시 받아 사라진 계좌는 무효다 */
export function canSubmitIncomeAccount(options: readonly IncomeAccountOption[], selectedId: number | null): boolean {
  return selectedId !== null && options.some((option) => option.accountId === selectedId);
}
