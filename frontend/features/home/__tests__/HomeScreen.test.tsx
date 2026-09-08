import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { budgetConfirmedMock, budgetProposedMock } from "@/api/mocks/budget";
import { attendanceMock, roomMock } from "@/api/mocks/room";
import { getBudget } from "@/features/budget/api/budget.api";
import { toBudget } from "@/features/budget/model";
import { HomeScreen } from "@/features/home/components/HomeScreen";
import { checkAttendance, getRoom } from "@/features/room/api/room.api";
import { ROOM_VIEW_TEST_ID } from "@/features/room/components/RoomView";
import { toAttendance, toRoom } from "@/features/room/model";

jest.mock("@/features/room/api/room.api", () => ({ getRoom: jest.fn(), checkAttendance: jest.fn() }));
jest.mock("@/features/budget/api/budget.api", () => ({ getBudget: jest.fn() }));

const MONTH = "202609";
jest.mock("@/lib/date", () => ({
  ...jest.requireActual<typeof import("@/lib/date")>("@/lib/date"),
  currentMonthKey: () => "202609",
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

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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
    mockPush.mockReset();
  });

  it("불러오는 동안 스켈레톤을 보여주고, 인사말·코인·방·예산 카드를 표시한다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetConfirmedMock(MONTH)));
    await renderHome();
    expect(screen.getByLabelText("불러오는 중")).toBeTruthy();

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
    fireEvent(screen.getByTestId(ROOM_VIEW_TEST_ID), "layout", { nativeEvent: { layout: { width: 327, height: 404 } } });

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
  });

  it("예산이 미승인이면 벽 보드는 미설정으로 보이고 팝오버는 승인 안내를 보여준다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom({ ...roomMock, attendance: { checkedToday: true } }));
    mockedGetBudget.mockResolvedValue(toBudget(budgetProposedMock(MONTH)));
    await renderHome();
    await screen.findByText("9월 예산이 아직 없어요");
    fireEvent(screen.getByTestId(ROOM_VIEW_TEST_ID), "layout", { nativeEvent: { layout: { width: 327, height: 404 } } });

    await fireEvent.press(await screen.findByRole("button", { name: "예산 보드, 9월 예산 미설정" }));
    expect(await screen.findByText("예산을 승인하면 봉투별 잔액이 여기에 보여요.")).toBeTruthy();
  });

  it("예산이 미승인이면 승인 유도 배너를 보여주고, 버튼은 예산 탭으로 이동한다", async () => {
    mockedGetRoom.mockResolvedValue(toRoom(roomMock));
    mockedGetBudget.mockResolvedValue(toBudget(budgetProposedMock(MONTH)));
    await renderHome();

    expect(await screen.findByText("9월 예산이 아직 없어요")).toBeTruthy();
    expect(screen.queryByText("이번 달 남은 예산")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "이 예산으로 시작하기" }));
    expect(mockPush).toHaveBeenCalledWith("/budget");
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
