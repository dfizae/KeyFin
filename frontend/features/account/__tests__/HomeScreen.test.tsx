import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { homeSummaryMock } from "@/api/mocks/home";
import { getHomeSummary } from "@/features/account/api/account.api";
import { HomeScreen } from "@/features/account/components/HomeScreen";
import { toHomeSummary } from "@/features/account/model";

jest.mock("@/features/account/api/account.api", () => ({
  USE_MOCKS: true,
  getHomeSummary: jest.fn(),
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
  });

  it("불러오는 동안 스켈레톤을 보여주고 완료되면 인사말·계좌·메뉴를 표시한다", async () => {
    mockedGetHomeSummary.mockResolvedValue(toHomeSummary(homeSummaryMock));
    await renderHome();
    expect(screen.getByLabelText("불러오는 중")).toBeTruthy();

    expect(await screen.findByText("안녕하세요, 김재영님")).toBeTruthy();
    expect(screen.getByText("110-***-**6789")).toBeTruthy();
    expect(screen.getByText("3,469,520원")).toBeTruthy();
    expect(screen.getByRole("button", { name: "알림 3개" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /계좌·카드|이체|출금/ })).toHaveLength(3);
    expect(screen.queryByLabelText("불러오는 중")).toBeNull();
  });

  it("계좌가 없으면 빈 상태를 표시한다", async () => {
    mockedGetHomeSummary.mockResolvedValue(toHomeSummary({ ...homeSummaryMock, primaryAccount: null }));
    await renderHome();
    expect(await screen.findByText("연결된 계좌가 없어요")).toBeTruthy();
    expect(screen.queryByText("3,469,520원")).toBeNull();
  });

  it("실패하면 오류와 재시도 버튼을 보여주고, 재시도 성공 시 내용을 표시한다", async () => {
    mockedGetHomeSummary
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(toHomeSummary(homeSummaryMock));
    await renderHome();

    expect(await screen.findByText("정보를 불러오지 못했어요")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("안녕하세요, 김재영님")).toBeTruthy();
    expect(mockedGetHomeSummary).toHaveBeenCalledTimes(2);
  });
});
