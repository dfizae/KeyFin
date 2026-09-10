import { ApiError } from "@/api/error";
import type {
  FinanceLinkRequest,
  FinanceLinkResponseDto,
  FinanceStatusDto,
  LinkCandidateAccountDto,
  LinkCandidateCardDto,
  LinkCandidatesDto,
  LinkRequest,
  LinkResponseDto,
} from "@/features/link/model";

/**
 * 목 규칙: 금융망에 있는 이메일만 연결된다.
 * 서버 없이도 성공·없는 회원·중복 연결 세 경우를 모두 확인하려고 둔 값이다.
 */
export const MOCK_FINANCE_EMAIL = "finance@qwer.com";
/** 다른 KeyFin 계정이 이미 쓰고 있는 금융망 계정 (LINK_001) */
export const MOCK_TAKEN_FINANCE_EMAIL = "taken@qwer.com";

/** 앱이 도는 동안만 유지되는 연결 상태. 서버의 users.fin_user_key 자리를 대신한다 */
let connected = false;

export function financeStatusMock(): FinanceStatusDto {
  return { financeConnected: connected };
}

/** 테스트·개발 재시작용 */
export function resetLinkMocks(): void {
  connected = false;
  linkedAccounts.clear();
  linkedAccounts.add("0903303456789012");
  linkedCards.clear();
}

export function connectFinanceMock({ financeEmail }: FinanceLinkRequest): FinanceLinkResponseDto {
  const email = financeEmail.trim().toLowerCase();
  if (email === MOCK_TAKEN_FINANCE_EMAIL) {
    throw new ApiError(409, "LINK_001", "해당 금융망 사용자는 이미 다른 계정과 연결되어 있습니다.");
  }
  if (email !== MOCK_FINANCE_EMAIL) {
    throw new ApiError(404, "FINANCE_001", "금융망에서 일치하는 사용자를 찾을 수 없습니다.");
  }
  connected = true;
  return { connected: true };
}

/**
 * 연결 후보 목록. 금융망이 주는 값이라 앱에서 만들지 않고, 목에서는 고정 목록으로 둔다.
 * 로고 있는 은행(088·004·090)과 로고 없는 폴백 타일(999)을 섞어 두 경우를 다 보이게 했다.
 * 카카오뱅크 계좌는 처음부터 linked=true 라 '연결됨'으로 잠긴 행을 확인할 수 있다.
 */
const CANDIDATE_ACCOUNTS: readonly Omit<LinkCandidateAccountDto, "linked">[] = [
  { finAccountNo: "0885401234567890", bankCode: "088", bankName: "신한은행", balance: 2_450_000 },
  { finAccountNo: "0041202345678901", bankCode: "004", bankName: "국민은행", balance: 318_400 },
  { finAccountNo: "0903303456789012", bankCode: "090", bankName: "카카오뱅크", balance: 1_007_250 },
  { finAccountNo: "9990104567890123", bankCode: "999", bankName: "싸피은행", balance: 50_000 },
];

const CANDIDATE_CARDS: readonly Omit<LinkCandidateCardDto, "linked">[] = [
  { cardNo: "5310123412341234", issuerName: "신한카드", cardName: "Deep Dream 체크", withdrawalAccountNo: "0885401234567890" },
  { cardNo: "9410432143214321", issuerName: "국민카드", cardName: "노리 체크", withdrawalAccountNo: "0041202345678901" },
];

/** 앱이 도는 동안만 유지되는 연결 결과. 서버의 accounts·cards 테이블 자리를 대신한다 */
const linkedAccounts = new Set<string>(["0903303456789012"]);
const linkedCards = new Set<string>();

export function linkCandidatesMock(): LinkCandidatesDto {
  return {
    accounts: CANDIDATE_ACCOUNTS.map((a) => ({ ...a, linked: linkedAccounts.has(a.finAccountNo) })),
    cards: CANDIDATE_CARDS.map((c) => ({ ...c, linked: linkedCards.has(c.cardNo) })),
  };
}

/** 이미 연결된 항목은 세지 않는다(멱등). 응답은 '새로 연결된 수' 다 */
export function createLinksMock({ accounts, cards }: LinkRequest): LinkResponseDto {
  let addedAccounts = 0;
  for (const no of accounts) {
    if (!linkedAccounts.has(no)) {
      linkedAccounts.add(no);
      addedAccounts += 1;
    }
  }
  let addedCards = 0;
  for (const no of cards) {
    if (!linkedCards.has(no)) {
      linkedCards.add(no);
      addedCards += 1;
    }
  }
  return { accounts: addedAccounts, cards: addedCards };
}
