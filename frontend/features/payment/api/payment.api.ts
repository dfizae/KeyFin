import { TIMEOUT_MONEY_MS, api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import {
  createFixedExpenseMock,
  deleteFixedExpenseMock,
  fixedExpenseListMock,
  paymentCalendarMock,
  updateFixedExpenseMock,
} from "@/api/mocks/payment";
import { approveTransferMock, postponeTransferMock, transferListMock } from "@/api/mocks/transfer";
import {
  toFixedExpenses,
  toPaymentCalendar,
  toTransfers,
  type ApproveTransferDto,
  type FixedExpense,
  type FixedExpenseListDto,
  type FixedExpenseRequest,
  type FixedExpenseResponseDto,
  type PaymentCalendar,
  type PaymentCalendarDto,
  type Transfer,
  type TransferListDto,
  type TransferStatus,
} from "@/features/payment/model";
import { serverClock, toKSTDateKey } from "@/lib/date";

/**
 * GET /payments/calendar?month=YYYYMM — 날짜별 출금 예정과 준비 상태 (docs/api-contract.md PAYMENT, FR-PAY-01·02).
 * 서버는 호출할 때 금융망 정기결제를 먼저 동기화하고, 실패해도 저장된 항목으로 응답한다.
 */
export async function getPaymentCalendar(month: string, signal?: AbortSignal): Promise<PaymentCalendar> {
  if (isMocked("payment")) return toPaymentCalendar(await withMockLatency(paymentCalendarMock(month), signal));
  const { data } = await api.get<PaymentCalendarDto>("/payments/calendar", { params: { month }, signal });
  return toPaymentCalendar(data);
}

/** GET /fixed-expenses — 활성 고정지출을 등록 순으로. 동기화 항목(synced)도 섞여 온다 (FR-PAY-07) */
export async function getFixedExpenses(signal?: AbortSignal): Promise<FixedExpense[]> {
  if (isMocked("payment")) return toFixedExpenses(await withMockLatency(fixedExpenseListMock(), signal));
  const { data } = await api.get<FixedExpenseListDto>("/fixed-expenses", { signal });
  return toFixedExpenses(data);
}

/** POST /fixed-expenses — 201 (FR-PAY-07). 응답은 새 id 뿐이라 화면은 목록·캘린더를 다시 받는다 */
export async function createFixedExpense(request: FixedExpenseRequest): Promise<number> {
  if (isMocked("payment")) return (await withMockLatency(createFixedExpenseMock(request))).id;
  const { data } = await api.post<FixedExpenseResponseDto>("/fixed-expenses", request);
  return data.id;
}

export type UpdateFixedExpenseInput = { id: number; request: FixedExpenseRequest };

/** PUT /fixed-expenses/{id} — 등록과 같은 본문 전체로 교체한다(부분 수정 없음). 동기화 항목은 409 PAY_002 */
export async function updateFixedExpense({ id, request }: UpdateFixedExpenseInput): Promise<number> {
  if (isMocked("payment")) return (await withMockLatency(updateFixedExpenseMock(id, request))).id;
  const { data } = await api.put<FixedExpenseResponseDto>(`/fixed-expenses/${id}`, request);
  return data.id;
}

/** DELETE /fixed-expenses/{id} — data 는 null. 서버는 비활성으로 바꾸고 앞으로의 일정에서 뺀다 */
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
