import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useRouter } from "expo-router";

import { getCoachingNotifications } from "@/features/coaching/api";
import { CoachingMessage } from "@/features/coaching/components/CoachingMessage";
import { CoachingNotificationsScreen } from "@/features/coaching/components/CoachingNotificationsScreen";
import { CoachingScreen } from "@/features/coaching/components/CoachingScreen";
import { useCoachingChat } from "@/features/coaching/useCoachingChat";

jest.mock("expo-router", () => ({ useRouter: jest.fn() }));
jest.mock("@/features/coaching/api", () => ({ getCoachingNotifications: jest.fn() }));
jest.mock("@/features/coaching/useCoachingChat", () => ({ useCoachingChat: jest.fn() }));

it("lets an empty conversation select an example and send a general financial question", async () => {
  const send = jest.fn().mockResolvedValue(true);
  jest.mocked(useCoachingChat).mockReturnValue({ messages: [], busy: false, error: null, retryPending: false,
    send, retry: jest.fn(), changeQuestion: jest.fn() });
  await render(<CoachingScreen />);
  expect(screen.getByText("어떤 점이 궁금하세요?")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("예금과 적금은 어떻게 달라?"));
  await fireEvent.press(screen.getByLabelText("질문 보내기"));
  expect(send).toHaveBeenCalledWith("예금과 적금은 어떻게 달라?");
});

it("renders insufficient data without claiming successful financial calculation", async () => {
  await render(<CoachingMessage onLinkError={jest.fn()} message={{ id: "answer-1", role: "assistant", text: "잔액 자료가 필요해요",
    answer: { id: "answer-1", kind: "coaching", status: "needs_data", text: "잔액 자료가 필요해요",
      references: [], period: null, fallback: true } }} />);
  expect(screen.getByText("자료 확인 필요")).toBeTruthy();
  expect(screen.queryByText(/수치 계산은 완료/)).toBeNull();
  expect(screen.queryByText(/예측 기간/)).toBeNull();
});

it("opens a notification with both server resource IDs rather than embedding a generated answer", async () => {
  const push = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ push, replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(),
    dismiss: jest.fn(), dismissAll: jest.fn(), dismissTo: jest.fn(), canDismiss: jest.fn(), navigate: jest.fn(),
    setParams: jest.fn(), reload: jest.fn(), prefetch: jest.fn() });
  jest.mocked(getCoachingNotifications).mockResolvedValue([{ event_id: "notice-1", type: "COACHING", coaching_id: "coaching-1",
    text: "식비 코칭 도착", created_at: 1, acknowledged: false }]);
  await render(<CoachingNotificationsScreen />);
  await waitFor(() => expect(screen.getByText("식비 코칭 도착")).toBeTruthy());
  await fireEvent.press(screen.getByLabelText("새 알림: 식비 코칭 도착"));
  expect(push).toHaveBeenCalledWith({ pathname: "/coach", params: { coaching: "coaching-1", notification: "notice-1" } });
});
