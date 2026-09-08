import type {
  ClassifyRequest,
  ClassifyResponseDto,
  PendingTransactionsDto,
  SubcategoryListDto,
  TransactionDto,
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
