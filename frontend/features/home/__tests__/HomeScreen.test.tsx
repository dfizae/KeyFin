import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { budgetConfirmedMock, budgetProposedMock } from "@/api/mocks/budget";
import { paymentCalendarEmptyMock, paymentCalendarMock } from "@/api/mocks/payment";
import { attendanceMock, roomMock } from "@/api/mocks/room";
import { classifyTransactionMock, pendingTransactionsMock, resetTransactionMocks, subcategoriesMock } from "@/api/mocks/transaction";
import { getBudget } from "@/features/budget/api/budget.api";
import { toBudget } from "@/features/budget/model";
import { CLASSIFY_ERROR_MESSAGE } from "@/features/home/components/HomeCoach";
import { HomeScreen } from "@/features/home/components/HomeScreen";
import { getPaymentCalendar } from "@/features/payment/api/payment.api";
import { toPaymentCalendar } from "@/features/payment/model";
import { checkAttendance, getRoom } from "@/features/room/api/room.api";
import { ROOM_VIEW_TEST_ID } from "@/features/room/components/RoomView";
import { toAttendance, toRoom } from "@/features/room/model";
import { classifyTransaction, getPendingTransactions, getSubcategories } from "@/features/transaction/api/transaction.api";
import { toClassifyResult, toPendingTransactions, toSubcategories } from "@/features/transaction/model";

jest.mock("@/features/room/api/room.api", () => ({ getRoom: jest.fn(), checkAttendance: jest.fn() }));
jest.mock("@/features/budget/api/budget.api", () => ({ getBudget: jest.fn() }));
jest.mock("@/features/payment/api/payment.api", () => ({ getPaymentCalendar: jest.fn() }));
jest.mock("@/features/transaction/api/transaction.api", () => ({
  getPendingTransactions: jest.fn(),
  getSubcategories: jest.fn(),
  classifyTransaction: jest.fn(),
}));

// 쿼리 알림을 setTimeout 이 아니라 그 자리에서 보내, 목 응답이 act 범위 안에서 화면에 반영되게 한다.
notifyManager.setScheduler((callback) => callback());

const MONTH = "202609";
jest.mock("@/lib/date", () => ({
  ...jest.requireActual<typeof import("@/lib/date")>("@/lib/date"),
  currentMonthKey: () => "202609",
  currentDateKey: () => "2026-09-08",
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => ReactActual.useEffect(effect, [effect]),
  };
});

const mockedGetRoom = jest.mocked(getRoom);
const mockedGetBudget = jest.mocked(getBudget);
const mockedCheckAttendance = jest.mocked(checkAttendance);
const mockedGetCalendar = jest.mocked(getPaymentCalendar);
const mockedGetPending = jest.mocked(getPendingTransactions);
const mockedGetSubcategories = jest.mocked(getSubcategories);
const mockedClassify = jest.mocked(classifyTransaction);

/** 방 폭을 재고, 그 뒤 붙는 오버레이(보드·캘린더·코치)의 조회가 끝날 때까지 기다린다 */
async function layoutRoom() {
  await fireEvent(screen.getByTestId(ROOM_VIEW_TEST_ID), "layout", { nativeEvent: { layout: { width: 327, height: 404 } } });
  await waitForQueriesToSettle();
}

let client: QueryClient;

/** 확정 뒤 무효화로 도는 재조회가 테스트 밖에서 끝나 act 경고를 내지 않도록 기다린다 */
async function waitForQueriesToSettle() {
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

function renderHome() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>
  );
}

describe("HomeScreen", () => {
  beforeEach(() => {
    mockedGetRoom.mockReset();
    mockedGetBudget.mockReset();
    mockedCheckAttendance.mockReset();
    mockedCheckAttendance.mockResolvedValue(toAttendance(attendanceMock));
    mockedGetCalendar.mockReset();
    mockedGetCalendar.mockResolvedValue(toPaymentCalendar(paymentCalendarMock(MONTH)));
    mockedGetPending.mockReset();
    mockedGetPending.mockResolvedValue({ items: [], nextCursor: null });
    mockedGetSubcategories.mockReset();
    mockedGetSubcategories.mockResolvedValue(toSubcategories(subcategoriesMock));
    mockedClassify.mockReset();
    mockedClassify.mockResolvedValue({ confirmStatus: "CONFIRMED", envelopeId: 1, remaining: "132000" });
    mockPush.mockReset();
  });

  // 확정 뒤 무효화로 다시 불러와도 확정한 거래가 빠지도록, 목 모듈의 상태를 그대로 쓴다.
  function mockPendingFlow() {
    resetTransactionMocks();
    mockedGetPending.mockImplementation(async () => toPendingTransactions(pendingTransactionsMock()));
    mockedClassify.mockImplementation(async ({ transactionId, request }) => toClassifyResult(classifyTransactionMock(transactionId, request)));
  }

  it("미확정 거래가 있으면 코치가 묻고, 확정을 누르면 제안된 세분류로 분류한 뒤 다음 질문으로 넘어간다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    mockPendingFlow();
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    expect(await screen.findByText("『메가커피 역삼점 4,500원』 카페 맞나냥?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "카페 확정" }));

    await waitFor(() => expect(mockedClassify).toHaveBeenCalledWith({ transactionId: 501, request: { subcategoryId: 102 } }));
    expect(await screen.findByText("『김씨네분식 12,000원』 음식점 맞나냥?")).toBeTruthy();
    await waitForQueriesToSettle();
  });

  it("다른 카테고리를 누르면 세분류 시트가 열리고, 세분류나 제외 태그를 고르면 그대로 분류한다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    mockPendingFlow();
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    await fireEvent.press(await screen.findByRole("button", { name: "다른 카테고리" }));
    expect(await screen.findByText("카테고리 선택")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "배달" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "카페" }).props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole("button", { name: "배달" }));
    await waitFor(() => expect(mockedClassify).toHaveBeenCalledWith({ transactionId: 501, request: { subcategoryId: 103 } }));
    await waitFor(() => expect(screen.queryByText("카테고리 선택")).toBeNull());

    await fireEvent.press(await screen.findByRole("button", { name: "다른 카테고리" }));
    await fireEvent.press(await screen.findByRole("button", { name: "더치페이" }));
    await waitFor(() => expect(mockedClassify).toHaveBeenLastCalledWith({ transactionId: 502, request: { excludeTag: "DUTCH" } }));
    await waitForQueriesToSettle();
  });

  it("분류 저장이 실패하면 말풍선에 오류 문구를 보여주고 다시 시도할 수 있다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    mockPendingFlow();
    mockedClassify.mockRejectedValueOnce(new Error("network"));
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    await fireEvent.press(await screen.findByRole("button", { name: "카페 확정" }));
    expect(await screen.findByText(CLASSIFY_ERROR_MESSAGE)).toBeTruthy();
    expect(screen.getByText("『메가커피 역삼점 4,500원』 카페 맞나냥?")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "카페 확정" }));
    expect(await screen.findByText("『김씨네분식 12,000원』 음식점 맞나냥?")).toBeTruthy();
    await waitForQueriesToSettle();
  });

  it("불러오는 동안 스켈레톤을 보여주고, 인사말·코인·방·예산 카드를 표시한다", async () => {
    let resolveRoom: (room: ReturnType<typeof toRoom>) => void = () => undefined;
    mockedGetRoom.mockReturnValue(new Promise((resolve) => (resolveRoom = resolve)));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();
    expect(screen.getByLabelText("불러오는 중")).toBeTruthy();

    await act(async () => resolveRoom(toRoom({ ...roomMock, attendance: { checkedToday: true } })));
    expect(await screen.findByText("김재영님, 안녕하세요!")).toBeTruthy();
    expect(screen.getByText("환영합니다")).toBeTruthy();
    expect(screen.getByLabelText("코인 1,250개")).toBeTruthy();
    expect(screen.getByRole("button", { name: "알림" })).toBeTruthy();
    expect(screen.getByLabelText("캐릭터가 방에 있어요")).toBeTruthy();

    expect(await screen.findByText("180,000원")).toBeTruthy();
    expect(screen.getByText("이번 달 남은 예산")).toBeTruthy();
    expect(screen.getByText("총 예산 500,000원 중 320,000원 사용")).toBeTruthy();
    expect(screen.getByText("좋아요!")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "예산 사용률" }).props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 64,
    });
    expect(mockedGetBudget).toHaveBeenCalledWith(MONTH, expect.anything());
    expect(screen.queryByLabelText("불러오는 중")).toBeNull();
  });

  it("오늘 출석 전이면 홈 진입 시 출석을 한 번 처리하고 코인 배지와 토스트를 갱신한다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom(roomMock));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();

    expect(await screen.findByLabelText("출석 +10 코인")).toBeTruthy();
    expect(screen.getByLabelText("코인 1,260개")).toBeTruthy();
    await waitFor(() => expect(mockedCheckAttendance).toHaveBeenCalledTimes(1));
  });

  it("오늘 이미 출석했으면 출석을 부르지 않는다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();

    expect(await screen.findByLabelText("코인 1,250개")).toBeTruthy();
    expect(await screen.findByText("180,000원")).toBeTruthy();
    expect(mockedCheckAttendance).not.toHaveBeenCalled();
  });

  it("지급 코인이 0이면 토스트 없이 잔액만 반영한다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom(roomMock));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    mockedCheckAttendance.mockResolvedValue(toAttendance({ granted: 0, balance: 1250 }));
    await renderHome();

    expect(await screen.findByLabelText("코인 1,250개")).toBeTruthy();
    await waitFor(() => expect(mockedCheckAttendance).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("180,000원")).toBeTruthy();
    expect(screen.queryByLabelText(/출석 \+/)).toBeNull();
  });

  it("예산 카드에 봉투 7종 사용률 막대를 그리고 초과 봉투는 사용률이 100 을 넘는다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();

    expect(await screen.findByText("봉투별 사용률")).toBeTruthy();
    expect(screen.getByLabelText("외식 사용률 68%, 남은 32,000원")).toBeTruthy();
    expect(screen.getByLabelText("쇼핑 사용률 109%, 남은 -8,000원")).toBeTruthy();
    expect(screen.getByText("마트")).toBeTruthy();
  });

  it("벽 보드 에셋은 잔여율을 보여주고, 탭하면 봉투별 잔액 팝오버가 열리며 링크는 예산 탭으로 간다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    const board = await screen.findByRole("button", { name: "예산 보드, 9월 36% 남음" });
    expect(screen.queryByText("9월 예산 보드")).toBeNull();

    await fireEvent.press(board);
    expect(await screen.findByText("9월 예산 보드")).toBeTruthy();
    expect(screen.getByText("180,000원 · 36% 남음")).toBeTruthy();
    expect(screen.getByLabelText("쇼핑 초과 8,000원 남음")).toBeTruthy();
    expect(screen.getByLabelText("외식 32,000원 남음")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "예산 탭에서 자세히" }));
    expect(mockPush).toHaveBeenCalledWith("/budget");

    await fireEvent.press(screen.getByRole("button", { name: "보드 닫기" }));
    expect(screen.queryByText("9월 예산 보드")).toBeNull();
    await waitForQueriesToSettle();
  });

  it("예산이 미승인이면 벽 보드는 미설정으로 보이고 팝오버는 승인 안내를 보여준다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetProposedMock(MONTH)));
    await renderHome();
    await screen.findByText("9월 예산이 아직 없어요");
    await layoutRoom();

    await fireEvent.press(await screen.findByRole("button", { name: "예산 보드, 9월 예산 미설정" }));
    expect(await screen.findByText("예산을 승인하면 봉투별 잔액이 여기에 보여요.")).toBeTruthy();
    await waitForQueriesToSettle();
  });

  it("캘린더 에셋은 다음 출금을 보여주고, 탭하면 날짜별 출금 일정과 준비 상태가 열린다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    const calendar = await screen.findByRole("button", { name: "출금 캘린더, 9월 15일 월세, 준비 부족" });
    expect(screen.queryByText("9월 출금 일정")).toBeNull();

    await fireEvent.press(calendar);
    expect(await screen.findByText("9월 출금 일정")).toBeTruthy();
    expect(screen.getByText("3건 · 부족 1건")).toBeTruthy();
    expect(screen.getByLabelText("15일 월세 550,000원, 부족 230,000원")).toBeTruthy();
    expect(screen.getByLabelText("20일 넷플릭스 17,000원, 준비됨")).toBeTruthy();
    expect(screen.getByLabelText("25일 통신비 (예상) 55,000원, 준비됨")).toBeTruthy();
    expect(screen.getByRole("button", { name: "캘린더 열기" }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(mockedGetCalendar).toHaveBeenCalledWith(MONTH, expect.anything());

    await fireEvent.press(screen.getByRole("button", { name: "출금 일정 닫기" }));
    expect(screen.queryByText("9월 출금 일정")).toBeNull();
    await waitForQueriesToSettle();
  });

  it("이번 달 출금 예정이 없으면 캘린더는 예정 없음으로 보이고 팝오버는 빈 상태를 알린다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    mockedGetCalendar.mockResolvedValue(toPaymentCalendar(paymentCalendarEmptyMock));
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    await fireEvent.press(await screen.findByRole("button", { name: "출금 캘린더, 9월 출금 예정 없음" }));
    expect(await screen.findByText("이번 달 출금 예정이 없어요.")).toBeTruthy();
    expect(screen.getByText("0건")).toBeTruthy();
    await waitForQueriesToSettle();
  });

  it("벽 오브젝트 팝오버는 한 번에 하나만 열린다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    await fireEvent.press(await screen.findByRole("button", { name: "예산 보드, 9월 36% 남음" }));
    expect(await screen.findByText("9월 예산 보드")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "출금 캘린더, 9월 15일 월세, 준비 부족" }));
    expect(await screen.findByText("9월 출금 일정")).toBeTruthy();
    expect(screen.queryByText("9월 예산 보드")).toBeNull();
    await waitForQueriesToSettle();
  });

  it("결제 일정만 못 받으면 캘린더 에셋만 감추고 나머지는 그대로 둔다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    mockedGetCalendar.mockRejectedValue(new Error("network"));
    await renderHome();
    await screen.findByText("180,000원");
    await layoutRoom();

    expect(await screen.findByRole("button", { name: "예산 보드, 9월 36% 남음" })).toBeTruthy();
    expect(screen.queryByLabelText(/출금 캘린더/)).toBeNull();
    await waitForQueriesToSettle();
  });

  it("예산이 미승인이면 승인 유도 배너를 보여주고, 버튼은 예산 제안·승인 화면으로 이동한다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom(roomMock));
    mockedGetBudget.mockResolvedValue(toBudget(budgetProposedMock(MONTH)));
    await renderHome();

    expect(await screen.findByText("9월 예산이 아직 없어요")).toBeTruthy();
    expect(screen.queryByText("이번 달 남은 예산")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "이 예산으로 시작하기" }));
    expect(mockPush).toHaveBeenCalledWith("/onboarding/budget-proposal");
  });

  it("방 정보를 못 받으면 화면 전체에 오류와 재시도를 보여주고, 재시도 성공 시 내용을 표시한다", async () => {
    mockedGetRoom.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(toRoom(roomMock));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();

    expect(await screen.findByText("방 정보를 불러오지 못했어요")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("김재영님, 안녕하세요!")).toBeTruthy();
    expect(mockedGetRoom).toHaveBeenCalledTimes(2);
  });

  it("예산만 못 받으면 방은 그대로 두고 예산 영역에서만 재시도한다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom(roomMock));
    mockedGetBudget.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();

    expect(await screen.findByText("예산을 불러오지 못했어요")).toBeTruthy();
    expect(screen.getByText("김재영님, 안녕하세요!")).toBeTruthy();
    expect(screen.getByLabelText("캐릭터가 방에 있어요")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("180,000원")).toBeTruthy();
    expect(mockedGetBudget).toHaveBeenCalledTimes(2);
  });
});
