import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { homeSummaryMock } from "@/api/mocks/home";
import { getHomeSummary } from "@/features/home/api/home.api";
import { HomeScreen } from "@/features/home/components/HomeScreen";
import { toHomeSummary } from "@/features/home/model";

jest.mock("@/features/home/api/home.api", () => ({
  USE_MOCKS: true,
  getHomeSummary: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockedGetHomeSummary = jest.mocked(getHomeSummary);

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
    mockedGetHomeSummary.mockReset();
    mockPush.mockReset();
  });

  it("불러오는 동안 스켈레톤을 보여주고, 캐릭터가 있으면 인사말·코인·예산 카드를 표시한다", async () => {
    mockedGetHomeSummary.mockResolvedValue(toHomeSummary(homeSummaryMock));
    await renderHome();
    expect(screen.getByLabelText("불러오는 중")).toBeTruthy();

    expect(await screen.findByText("김재영님, 안녕하세요!")).toBeTruthy();
    expect(screen.getByText("환영합니다")).toBeTruthy();
    expect(screen.getByLabelText("코인 1,250개")).toBeTruthy();
    expect(screen.getByRole("button", { name: "상점, 새 소식 3개" })).toBeTruthy();
    expect(screen.getByLabelText("키핀 캐릭터가 방에 있어요")).toBeTruthy();

    expect(screen.getByText("이번 달 남은 예산")).toBeTruthy();
    expect(screen.getByText("180,000원")).toBeTruthy();
    expect(screen.getByText("총 예산 500,000원 중 320,000원 사용")).toBeTruthy();
    expect(screen.getByText("좋아요!")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "예산 사용률" }).props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 64,
    });

    expect(screen.queryByRole("button", { name: "캐릭터를 등록하세요" })).toBeNull();
    expect(screen.queryByLabelText("불러오는 중")).toBeNull();
  });

  it("캐릭터가 없으면 빈 방 전체가 등록 버튼이고, 코인 배지와 예산 카드는 숨긴다", async () => {
    mockedGetHomeSummary.mockResolvedValue(toHomeSummary({ ...homeSummaryMock, character: null }));
    await renderHome();

    const register = await screen.findByRole("button", { name: "캐릭터를 등록하세요" });
    expect(screen.queryByLabelText("코인 1,250개")).toBeNull();
    expect(screen.queryByText("이번 달 남은 예산")).toBeNull();
    expect(screen.getByRole("button", { name: "상점, 새 소식 3개" })).toBeTruthy();

    await fireEvent.press(register);
    expect(mockPush).toHaveBeenCalledWith("/character/register");
  });

  it("예산 정보가 없으면 예산 카드를 표시하지 않는다", async () => {
    mockedGetHomeSummary.mockResolvedValue(toHomeSummary({ ...homeSummaryMock, monthlyBudget: null }));
    await renderHome();

    expect(await screen.findByText("김재영님, 안녕하세요!")).toBeTruthy();
    expect(screen.queryByText("이번 달 남은 예산")).toBeNull();
  });

  it("실패하면 오류와 재시도 버튼을 보여주고, 재시도 성공 시 내용을 표시한다", async () => {
    mockedGetHomeSummary
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(toHomeSummary(homeSummaryMock));
    await renderHome();

    expect(await screen.findByText("정보를 불러오지 못했어요")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("김재영님, 안녕하세요!")).toBeTruthy();
    expect(mockedGetHomeSummary).toHaveBeenCalledTimes(2);
  });
});
