import { ContractMismatchError } from "@/lib/contract";
import { maskAccount, maskCardNumber } from "@/lib/mask";
import { fromServerWon, type KRW } from "@/lib/money";

/**
 * 금융망 연결 계약 (docs/api-contract.md LINK, 2026-09-10 백엔드 자료).
 * 서버가 KeyFin 사용자 토큰으로 인증하고, 입력한 금융망 이메일로 회원을 조회해 userKey 를 서버에 보관한다.
 * userKey 는 응답에 없고 클라이언트가 보내지도 않는다.
 */
export type FinanceLinkRequest = { financeEmail: string };

/** GET /links/status. 미연결도 정상 상태라 200 + false 로 온다 */
export type FinanceStatusDto = { financeConnected: boolean };

export type FinanceLinkResponseDto = { connected: boolean };

/** 금융망 이메일 제한: 형식과 최대 100자 (COMMON_001 을 미리 막는다) */
export const FINANCE_EMAIL_MAX_LENGTH = 100;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canSubmitFinanceEmail(email: string): boolean {
  const trimmed = email.trim();
  return EMAIL.test(trimmed) && trimmed.length <= FINANCE_EMAIL_MAX_LENGTH;
}

/** GET /links/candidates 응답 DTO (docs/api-contract.md LINK, FR-USR-02) */
export type LinkCandidateAccountDto = {
  finAccountNo: string;
  bankCode: string;
  bankName: string;
  balance: number;
  linked: boolean;
};

export type LinkCandidateCardDto = {
  cardNo: string;
  issuerName: string;
  cardName: string;
  withdrawalAccountNo: string;
  linked: boolean;
};

export type LinkCandidatesDto = { accounts: LinkCandidateAccountDto[]; cards: LinkCandidateCardDto[] };

/**
 * 화면 모델. 금액은 KRW 문자열로, 번호는 마스킹된 표시값으로 바꿔 둔다.
 * 원본 번호는 POST /links 의 식별자라 그대로 들고 있고 화면에는 내보내지 않는다.
 */
export type LinkAccount = {
  finAccountNo: string;
  bankCode: string;
  bankName: string;
  maskedNo: string;
  balance: KRW;
  linked: boolean;
};

export type LinkCard = {
  cardNo: string;
  issuerName: string;
  cardName: string;
  maskedNo: string;
  maskedWithdrawalNo: string;
  linked: boolean;
};

export type LinkCandidates = { accounts: LinkAccount[]; cards: LinkCard[] };

/** POST /links — finAccountNo·cardNo 목록. 이미 연결된 항목은 서버가 무시한다(멱등) */
export type LinkRequest = { accounts: string[]; cards: string[] };

/** 새로 연결된 수 */
export type LinkResponseDto = { accounts: number; cards: number };

function won(value: number, field: string): KRW {
  try {
    return fromServerWon(value);
  } catch {
    throw new ContractMismatchError(field);
  }
}

function toLinkAccount(dto: LinkCandidateAccountDto): LinkAccount {
  if (dto.finAccountNo.length === 0) throw new ContractMismatchError("accounts.finAccountNo");
  return {
    finAccountNo: dto.finAccountNo,
    bankCode: dto.bankCode,
    bankName: dto.bankName,
    maskedNo: maskAccount(dto.finAccountNo),
    balance: won(dto.balance, "accounts.balance"),
    linked: dto.linked,
  };
}

function toLinkCard(dto: LinkCandidateCardDto): LinkCard {
  if (dto.cardNo.length === 0) throw new ContractMismatchError("cards.cardNo");
  return {
    cardNo: dto.cardNo,
    issuerName: dto.issuerName,
    cardName: dto.cardName,
    maskedNo: maskCardNumber(dto.cardNo),
    maskedWithdrawalNo: maskAccount(dto.withdrawalAccountNo),
    linked: dto.linked,
  };
}

export function toLinkCandidates(dto: LinkCandidatesDto): LinkCandidates {
  return { accounts: dto.accounts.map(toLinkAccount), cards: dto.cards.map(toLinkCard) };
}

/** 연결된 항목은 선택 대상이 아니다 (행이 '연결됨'으로 잠긴다) */
export function isLinkSelectable(item: { linked: boolean }): boolean {
  return !item.linked;
}

/** 체크 토글. 새 Set 을 돌려주어 호출부가 그대로 setState 에 넣을 수 있다 */
export function toggleLinkSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
}

/**
 * 선택 집합을 POST /links 본문으로 바꾼다.
 * 후보 목록을 근거로 걸러내므로 이미 연결된 항목이나 사라진 후보는 요청에 섞이지 않는다.
 */
export function toLinkRequest(candidates: LinkCandidates, selected: ReadonlySet<string>): LinkRequest {
  return {
    accounts: candidates.accounts.filter((a) => isLinkSelectable(a) && selected.has(a.finAccountNo)).map((a) => a.finAccountNo),
    cards: candidates.cards.filter((c) => isLinkSelectable(c) && selected.has(c.cardNo)).map((c) => c.cardNo),
  };
}

/** CTA 활성 조건: 실제로 보낼 것이 하나라도 있어야 한다 */
export function canSubmitLinks(request: LinkRequest): boolean {
  return request.accounts.length + request.cards.length > 0;
}

/** 후보가 아예 없으면 빈 상태 화면으로 간다 (시안 asset-select/empty) */
export function hasNoLinkCandidates(candidates: LinkCandidates): boolean {
  return candidates.accounts.length === 0 && candidates.cards.length === 0;
}

/** 헤더 '전체 선택'이 다룰 수 있는 항목. 이미 연결된 행은 잠겨 있어 뺀다 */
export function selectableLinkIds(candidates: LinkCandidates): string[] {
  return [
    ...candidates.accounts.filter(isLinkSelectable).map((account) => account.finAccountNo),
    ...candidates.cards.filter(isLinkSelectable).map((card) => card.cardNo),
  ];
}

/** 고를 수 있는 항목이 있고 그것을 전부 골랐을 때만 true. 전부 연결된 목록은 '전체 선택'이 의미 없다 */
export function areAllLinksSelected(candidates: LinkCandidates, selected: ReadonlySet<string>): boolean {
  const ids = selectableLinkIds(candidates);
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

/** '전체 선택'을 누른 결과. 이미 전부 골랐으면 전부 푼다 */
export function toggleSelectAllLinks(candidates: LinkCandidates, selected: ReadonlySet<string>): Set<string> {
  const ids = selectableLinkIds(candidates);
  if (!areAllLinksSelected(candidates, selected)) return new Set([...selected, ...ids]);

  const next = new Set(selected);
  for (const id of ids) next.delete(id);
  return next;
}
