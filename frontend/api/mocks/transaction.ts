import type {
  ClassifyRequest,
  ClassifyResponseDto,
  PendingTransactionsDto,
  SubcategoryListDto,
  TransactionDto,
  TransactionListDto,
} from "@/features/transaction/model";

/** 계약 사본 TRANSACTION 의 응답 예시 + 시연용 미확정 거래 2건. 확정하면 목록에서 빠지도록 모듈 상태를 둔다. */
const PENDING: TransactionDto[] = [
  {
    id: 501,
    txType: "CARD",
    merchantName: "메가커피 역삼점",
    amount: 4500,
    txDate: "2026-09-08",
    txTime: "14:21:00",
    envelopeId: 1,
    subcategoryId: 102,
    subcategoryName: "카페",
    confirmStatus: "PENDING",
    excludeTag: "NONE",
    status: "NORMAL",
  },
  {
    id: 502,
    txType: "CARD",
    merchantName: "김씨네분식",
    amount: 12000,
    txDate: "2026-09-08",
    txTime: "12:05:00",
    envelopeId: 1,
    subcategoryId: 101,
    subcategoryName: "음식점",
    confirmStatus: "PENDING",
    excludeTag: "NONE",
    status: "NORMAL",
  },
];

const classifiedIds = new Set<number>();

export function pendingTransactionsMock(): PendingTransactionsDto {
  return { items: PENDING.filter((item) => !classifiedIds.has(item.id)), nextCursor: null };
}

/** 확정 응답 예시. 외식 봉투 잔액 132,000 (계약 사본 예시 값) */
export function classifyTransactionMock(transactionId: number, request: ClassifyRequest): ClassifyResponseDto {
  classifiedIds.add(transactionId);
  const item = PENDING.find((candidate) => candidate.id === transactionId);
  return {
    confirmStatus: "CONFIRMED",
    envelopeBalance: { envelopeId: "subcategoryId" in request ? Math.floor(request.subcategoryId / 100) : (item?.envelopeId ?? 1), remaining: 132000 },
  };
}

/** GET /subcategories — ERD 기준 데이터 22종 (docs/api-contract.md §4) */
export const subcategoriesMock: SubcategoryListDto = {
  items: [
    { id: 101, name: "음식점", envelopeId: 1, envelopeName: "외식" },
    { id: 102, name: "카페", envelopeId: 1, envelopeName: "외식" },
    { id: 103, name: "배달", envelopeId: 1, envelopeName: "외식" },
    { id: 104, name: "주점", envelopeId: 1, envelopeName: "외식" },
    { id: 201, name: "대중교통", envelopeId: 2, envelopeName: "교통비" },
    { id: 202, name: "택시", envelopeId: 2, envelopeName: "교통비" },
    { id: 203, name: "주유", envelopeId: 2, envelopeName: "교통비" },
    { id: 301, name: "병원·약국", envelopeId: 3, envelopeName: "의료·건강" },
    { id: 302, name: "운동·헬스", envelopeId: 3, envelopeName: "의료·건강" },
    { id: 401, name: "영화·공연·전시", envelopeId: 4, envelopeName: "취미·여가" },
    { id: 402, name: "스포츠 관람", envelopeId: 4, envelopeName: "취미·여가" },
    { id: 403, name: "게임·콘텐츠", envelopeId: 4, envelopeName: "취미·여가" },
    { id: 404, name: "여행·숙박", envelopeId: 4, envelopeName: "취미·여가" },
    { id: 501, name: "패션·잡화", envelopeId: 5, envelopeName: "쇼핑" },
    { id: 502, name: "뷰티", envelopeId: 5, envelopeName: "쇼핑" },
    { id: 503, name: "온라인 쇼핑", envelopeId: 5, envelopeName: "쇼핑" },
    { id: 601, name: "편의점", envelopeId: 6, envelopeName: "편의점·마트·잡화" },
    { id: 602, name: "마트", envelopeId: 6, envelopeName: "편의점·마트·잡화" },
    { id: 603, name: "생활용품", envelopeId: 6, envelopeName: "편의점·마트·잡화" },
    { id: 701, name: "교육", envelopeId: 7, envelopeName: "기타" },
    { id: 702, name: "해외 결제", envelopeId: 7, envelopeName: "기타" },
    { id: 703, name: "경조사·기타", envelopeId: 7, envelopeName: "기타" },
  ],
};

/** 테스트·개발 재시작용: 확정 기록을 비운다 */
export function resetTransactionMocks(): void {
  classifiedIds.clear();
}

/**
 * GET /transactions 목. 달마다 같은 목록을 만들어(날짜만 그 달로) 필터·커서를 서버처럼 흉내 낸다.
 * 계좌·카드 필터용 출처(accountId·cardId)는 응답에 없는 값이라 목 안에서만 들고 있다.
 * 금액·가맹점은 시연용 예시이고 실제 거래가 아니다.
 */
type MockSource = { accountId?: number; cardId?: number };
type MockMerchant = [name: string, envelopeId: number, subcategoryId: number, amount: number, source: MockSource];

const MOCK_MERCHANTS: readonly MockMerchant[] = [
  ["스타벅스 강남점", 1, 102, 6500, { cardId: 1 }],
  ["서울교통공사", 2, 201, 1400, { cardId: 2 }],
  ["김씨네분식", 1, 101, 9000, { cardId: 1 }],
  ["GS25 역삼점", 6, 601, 3200, { cardId: 2 }],
  ["올리브영 역삼점", 5, 502, 23000, { cardId: 1 }],
  ["카카오T", 2, 202, 12800, { cardId: 1 }],
  ["CGV 강남", 4, 401, 15000, { cardId: 2 }],
  ["이마트 성수점", 6, 602, 48700, { accountId: 1 }],
  ["연세정형외과", 3, 301, 8400, { cardId: 1 }],
  ["쿠팡", 5, 503, 32900, { cardId: 2 }],
];

const MOCK_TX_PER_DAY = 2;
const MOCK_PAST_MONTH_DAYS = 28;
const MOCK_PAYDAY = 10;
const MOCK_PAGE_SIZE = 20;

type MockEntry = { dto: TransactionDto; source: MockSource };

function subcategoryName(id: number): string {
  return subcategoriesMock.items.find((item) => item.id === id)?.name ?? "기타";
}

function monthTransactions(month: string, todayKey: string): MockEntry[] {
  const prefix = `${month.slice(0, 4)}-${month.slice(4)}`;
  if (prefix > todayKey.slice(0, 7)) return [];
  const lastDay = prefix === todayKey.slice(0, 7) ? Number(todayKey.slice(8)) : MOCK_PAST_MONTH_DAYS;
  const base = Number(month) * 1000;
  const entries: MockEntry[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${prefix}-${String(day).padStart(2, "0")}`;
    if (day === MOCK_PAYDAY) {
      entries.push({
        dto: {
          id: base + entries.length + 1, txType: "DEPOSIT", merchantName: "(주)하네스 급여", amount: 2_500_000, txDate: date, txTime: "09:00:00",
          envelopeId: 7, subcategoryId: 703, subcategoryName: subcategoryName(703), confirmStatus: "AUTO", excludeTag: "NONE", status: "NORMAL",
        },
        source: { accountId: 1 },
      });
    }
    for (let slot = 0; slot < MOCK_TX_PER_DAY; slot += 1) {
      const [merchantName, envelopeId, subcategoryId, amount, source] = MOCK_MERCHANTS[(day * MOCK_TX_PER_DAY + slot) % MOCK_MERCHANTS.length];
      entries.push({
        dto: {
          id: base + entries.length + 1, txType: source.cardId ? "CARD" : "WITHDRAW", merchantName, amount, txDate: date,
          txTime: slot === 0 ? "12:10:00" : "19:40:00", envelopeId, subcategoryId, subcategoryName: subcategoryName(subcategoryId),
          confirmStatus: "AUTO", excludeTag: day === 5 && slot === 1 ? "DUTCH" : "NONE", status: day === 3 && slot === 0 ? "CANCELED" : "NORMAL",
        },
        source,
      });
    }
  }
  return entries.sort((a, b) => b.dto.id - a.dto.id);
}

export type TransactionListMockQuery = {
  month: string;
  envelopeId?: number;
  accountId?: number;
  cardId?: number;
  cursor?: number;
  size?: number;
};

export function transactionListMock(query: TransactionListMockQuery, todayKey: string): TransactionListDto {
  const matched = monthTransactions(query.month, todayKey)
    .filter(
      ({ dto, source }) =>
        (query.envelopeId === undefined || dto.envelopeId === query.envelopeId) &&
        (query.accountId === undefined || source.accountId === query.accountId) &&
        (query.cardId === undefined || source.cardId === query.cardId)
    )
    .map(({ dto }) => dto);
  const start = query.cursor === undefined ? 0 : matched.findIndex((dto) => dto.id === query.cursor) + 1;
  const page = matched.slice(start, start + (query.size ?? MOCK_PAGE_SIZE));
  const hasMore = start + page.length < matched.length;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}
