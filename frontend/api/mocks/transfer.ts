import type { ApproveTransferDto, TransferDto, TransferListDto } from "@/features/payment/model";

/**
 * GET /transfers 응답 예시 (docs/api-contract.md PAYMENT).
 * 결제 캘린더 목의 15일 월세(부족 230,000)에 맞춘 제안 1건과, 실패 화면 확인용 1건을 둔다.
 * 승인하면 서버처럼 상태가 EXECUTED 로 바뀌어 다시 조회할 때 결과가 보인다.
 */
function scheduled(month: string, day: number): string {
  return `${month.slice(0, 4)}-${month.slice(4)}-${String(day).padStart(2, "0")}`;
}

function initial(month: string): TransferDto[] {
  return [
    {
      id: 501,
      status: "PROPOSED",
      scheduledDate: scheduled(month, 15),
      requiredAmount: 230000,
      fromAccountId: 1,
      toAccountId: 2,
      purpose: { type: "FIXED", name: "월세" },
    },
    {
      id: 502,
      status: "FAILED",
      scheduledDate: scheduled(month, 10),
      requiredAmount: 55000,
      fromAccountId: 1,
      toAccountId: 2,
      failReason: "출금 계좌 잔액이 부족해 이체하지 못했어요.",
      purpose: { type: "CARD_BILL", name: "통신비" },
    },
  ];
}

let transfers: TransferDto[] | null = null;

function ensure(month: string): TransferDto[] {
  if (transfers === null) transfers = initial(month);
  return transfers;
}

export function transferListMock(month: string, status?: string): TransferListDto {
  const items = ensure(month).filter((transfer) => status === undefined || transfer.status === status);
  return { items: items.map((transfer) => ({ ...transfer })) };
}

/** POST /transfers/{id}/approve — 서버가 동의·한도·계좌 자격을 검사한 뒤 실행한다. 목은 실행 성공만 흉내 낸다 */
export function approveTransferMock(id: number, now: string): ApproveTransferDto {
  transfers = (transfers ?? []).map((transfer) =>
    transfer.id === id ? { ...transfer, status: "EXECUTED", executedAt: now } : transfer
  );
  return { status: "EXECUTED", executedAt: now };
}

/** POST /transfers/{id}/postpone — 제안은 PROPOSED 로 남는다 */
export function postponeTransferMock(): void {
  return undefined;
}

/** 테스트·개발 재시작용 */
export function resetTransferMocks(): void {
  transfers = null;
}
