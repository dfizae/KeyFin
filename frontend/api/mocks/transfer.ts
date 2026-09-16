import type { ApproveTransferDto, TransferDto, TransferListDto } from "@/features/payment/model";

/**
 * GET /transfers 응답 예시 (docs/api-contract.md PAYMENT · 백엔드 TransferResponse).
 * 응답 `data` 는 배열이다 — items 래퍼가 없다.
 * 결제 캘린더 목의 15일 월세(fixedExpenseId 11 · 출금 계좌 1 · 부족 230,000)에 맞춘 제안 1건과, 실패 화면 확인용 1건을 둔다.
 * 캘린더 부족 뱃지가 이 제안으로 이어지려면 purpose.fixedExpenseId·dueDate·toAccountId 가 캘린더 목과 같아야 한다(findTransferForEntry).
 * 제안은 08:30 배치가 출금일 하루 전에 만들므로 scheduledDate = dueDate − 1 이다(월요일 출금 카드만 같은 날).
 * 승인하면 서버처럼 상태가 EXECUTED 로 바뀌어 다시 조회할 때 결과가 보인다.
 */
function dateOf(month: string, day: number): string {
  return `${month.slice(0, 4)}-${month.slice(4)}-${String(day).padStart(2, "0")}`;
}

function initial(month: string): TransferDto[] {
  return [
    {
      id: 501,
      status: "PROPOSED",
      scheduledDate: dateOf(month, 14),
      dueDate: dateOf(month, 15),
      requiredAmount: 230000,
      fromAccountId: 2,
      toAccountId: 1,
      purpose: { type: "FIXED", fixedExpenseId: 11, cardBillingId: null, name: "월세" },
      createdAt: `${dateOf(month, 14)}T08:30:12`,
    },
    {
      id: 502,
      status: "FAILED",
      scheduledDate: dateOf(month, 10),
      dueDate: dateOf(month, 10),
      requiredAmount: 55000,
      fromAccountId: 1,
      toAccountId: 2,
      failReason: "출금 계좌 잔액이 부족해 이체하지 못했어요.",
      purpose: { type: "CARD_BILL", fixedExpenseId: null, cardBillingId: 5, name: "통신비" },
      createdAt: `${dateOf(month, 10)}T08:30:09`,
    },
  ];
}

let transfers: TransferDto[] | null = null;

function ensure(month: string): TransferDto[] {
  if (transfers === null) transfers = initial(month);
  return transfers;
}

/** 서버는 최신순(id 내림차순)으로 주고, status 를 주면 그 상태만 준다 */
export function transferListMock(month: string, status?: string): TransferListDto {
  return ensure(month)
    .filter((transfer) => status === undefined || transfer.status === status)
    .map((transfer) => ({ ...transfer }))
    .sort((left, right) => right.id - left.id);
}

/**
 * POST /transfers/{id}/approve — 서버가 동의·한도·계좌 자격을 검사한 뒤 실행한다. 목은 실행 성공만 흉내 낸다.
 * 실행 중(APPROVED)인 건을 다시 승인하면 서버는 같은 기관거래고유번호로 재시도한다 — 목은 둘 다 성공으로 둔다.
 */
export function approveTransferMock(id: number, now: string): ApproveTransferDto {
  transfers = (transfers ?? []).map((transfer) =>
    transfer.id === id ? { ...transfer, status: "EXECUTED", executedAt: now } : transfer
  );
  return { id, status: "EXECUTED", executedAt: now, failReason: null };
}

/** POST /transfers/{id}/postpone — 제안은 PROPOSED 로 남고 서버는 감사 로그만 남긴다 */
export function postponeTransferMock(): void {
  return undefined;
}

/** 테스트·개발 재시작용 */
export function resetTransferMocks(): void {
  transfers = null;
}
