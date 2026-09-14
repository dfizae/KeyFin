import { TIMEOUT_MONEY_MS, api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { createFixedExpenseMock, deleteFixedExpenseMock, paymentCalendarMock, updateFixedExpenseMock } from "@/api/mocks/payment";
import { approveTransferMock, postponeTransferMock, transferListMock } from "@/api/mocks/transfer";
import {
  toPaymentCalendar,
  toTransfers,
  type ApproveTransferDto,
  type FixedExpenseRequest,
  type FixedExpenseResponseDto,
  type PaymentCalendar,
  type PaymentCalendarDto,
  type Transfer,
  type TransferListDto,
  type TransferStatus,
} from "@/features/payment/model";
import { serverClock, toKSTDateKey } from "@/lib/date";

/** GET /payments/calendar?month=YYYYMM — 날짜별 출금 예정과 준비 상태 (docs/api-contract.md PAYMENT, FR-PAY-01·02) */
export async function getPaymentCalendar(month: string, signal?: AbortSignal): Promise<PaymentCalendar> {
  if (isMocked("payment")) return toPaymentCalendar(await withMockLatency(paymentCalendarMock(month), signal));
  const { data } = await api.get<PaymentCalendarDto>("/payments/calendar", { params: { month }, signal });
  return toPaymentCalendar(data);
}

/** POST /fixed-expenses — 201 (FR-PAY-07). 응답은 새 id 뿐이라 화면은 캘린더를 다시 받는다 */
export async function createFixedExpense(request: FixedExpenseRequest): Promise<number> {
  if (isMocked("payment")) return (await withMockLatency(createFixedExpenseMock(request))).id;
  const { data } = await api.post<FixedExpenseResponseDto>("/fixed-expenses", request);
  return data.id;
}

export type UpdateFixedExpenseInput = { id: number; request: FixedExpenseRequest };

/**
 * PUT /fixed-expenses/{id} — 계약 사본에 요청 형태가 없다("POST 와 같다고 가정하지 말 것").
 * 화면을 열어 두려고 지금은 POST 본문을 그대로 보내고, 스펙이 오면 이 함수만 고친다 (TBD, 규칙 90).
 */
export async function updateFixedExpense({ id, request }: UpdateFixedExpenseInput): Promise<number> {
  if (isMocked("payment")) return (await withMockLatency(updateFixedExpenseMock(id, request))).id;
  const { data } = await api.put<FixedExpenseResponseDto>(`/fixed-expenses/${id}`, request);
  return data.id;
}

/** DELETE /fixed-expenses/{id} — 응답 형태 미확인이라 본문을 읽지 않는다 (TBD) */
export async function deleteFixedExpense(id: number): Promise<void> {
  if (isMocked("payment")) {
    await withMockLatency(deleteFixedExpenseMock(id));
    return;
  }
  await api.delete(`/fixed-expenses/${id}`);
}

export type TransferListParams = {
  /** "YYYYMM" */
  month: string;
  status?: TransferStatus;
};

/** GET /transfers — 준비 이체 제안·이력 (FR-PAY-03·08). 단건 조회가 없어 화면이 목록에서 id 를 찾는다 */
export async function getTransfers({ month, status }: TransferListParams, signal?: AbortSignal): Promise<Transfer[]> {
  if (isMocked("payment")) return toTransfers(await withMockLatency(transferListMock(month, status), signal));
  const { data } = await api.get<TransferListDto>("/transfers", { params: { month, status }, signal });
  return toTransfers(data);
}

export type ApproveTransferResult = { status: TransferStatus; executedAt: string };

/**
 * POST /transfers/{id}/approve — 돈이 실제로 움직인다.
 * 중복 실행은 서버가 기관거래고유번호로 막고(계약에 멱등성 키 없음, 규칙 90) 클라이언트는 같은 제안 id 로만 보낸다.
 * 자동 재시도는 하지 않는다 — 실패·미확인은 화면이 상태 조회로 확정한다 (규칙 80).
 */
export async function approveTransfer(transferId: number): Promise<ApproveTransferResult> {
  if (isMocked("payment")) {
    const now = `${toKSTDateKey(new Date(serverClock.now()))}T07:12:00`;
    const mock = await withMockLatency(approveTransferMock(transferId, now));
    return { status: "EXECUTED", executedAt: mock.executedAt };
  }
  const { data } = await api.post<ApproveTransferDto>(`/transfers/${transferId}/approve`, undefined, { timeout: TIMEOUT_MONEY_MS });
  return { status: "EXECUTED", executedAt: data.executedAt };
}

/** POST /transfers/{id}/postpone — 응답 본문 없음. 제안은 PROPOSED 로 남는다 */
export async function postponeTransfer(transferId: number): Promise<void> {
  if (isMocked("payment")) {
    await withMockLatency(postponeTransferMock());
    return;
  }
  await api.post(`/transfers/${transferId}/postpone`);
}
