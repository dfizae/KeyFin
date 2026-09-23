import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";
import type { FlatList, FlatListProps } from "react-native";

import { ApiError } from "@/api/error";
import { getChatHistory, sendChatMessage } from "@/features/coaching/api/coaching.api";
import { coachingKeys } from "@/features/coaching/api/queries";
import { CHAT_INPUT_LABEL, CHART_LINK_LABEL, CoachingChatScreen, SEND_LABEL, THINKING_LABEL } from "@/features/coaching/components/CoachingChatScreen";
import { appendChatTurn, EMPTY_CHAT_HISTORY, toChatHistory, toChatReply, type ChatHistory, type ChatReply } from "@/features/coaching/model";
import { getPendingTransactions } from "@/features/transaction/api/transaction.api";

jest.mock("@/features/coaching/api/coaching.api", () => ({ getChatHistory: jest.fn(), sendChatMessage: jest.fn() }));
jest.mock("@/features/transaction/api/transaction.api", () => ({ getPendingTransactions: jest.fn() }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, canGoBack: () => true, back: jest.fn() }) }));

type TestRow = { key: string; kind: string };
let mockListProps: FlatListProps<TestRow>;
const mockRowRenders: TestRow[][] = [];
const mockScrollToOffset = jest.fn();
const mockScrollToEnd = jest.fn();

// Jest에는 네이티브 레이아웃/스크롤이 없다. 목록 경계만 대체하고 화면·메시지·쿼리·mutation은 실제 구현을 쓴다.
jest.mock("@/components/ui/screen", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ...jest.requireActual("@/components/ui/screen"),
    ScreenFlatList(props: FlatListProps<TestRow> & { ref?: React.Ref<Pick<FlatList<TestRow>, "scrollToOffset" | "scrollToEnd">> }) {
      mockListProps = props;
      mockRowRenders.push(Array.from(props.data ?? []).map(({ key, kind }) => ({ key, kind })));
      ReactActual.useImperativeHandle(props.ref, () => ({ scrollToOffset: mockScrollToOffset, scrollToEnd: mockScrollToEnd }), []);
      return (
        <View testID={props.testID}>
          {props.ListHeaderComponent as React.ReactElement}
          {Array.from(props.data ?? []).map((item, index) => (
            <View key={props.keyExtractor?.(item, index)}>
              {props.renderItem?.({ item, index, separators: { highlight: jest.fn(), unhighlight: jest.fn(), updateProps: jest.fn() } })}
            </View>
          ))}
          {ReactActual.isValidElement(props.ListFooterComponent)
            ? ReactActual.cloneElement(props.ListFooterComponent as React.ReactElement<{ testID?: string }>, { testID: "chat-layout-marker" })
            : null}
        </View>
      );
    },
  };
});

notifyManager.setScheduler((callback) => callback());
const question = "이번 달 외식 얼마 남았어?";
const initialHistory = toChatHistory({
  messages: [{ role: "user", content: "이전 질문" }, { role: "assistant", content: "이전 답변" }],
  expiresAt: "2026-09-24T10:00:00",
});
const reply = toChatReply({
  reply: "외식 봉투에 35,500원 남았어요.", kind: "CHAT", status: "answered", source: "engine",
  answerId: "reply-1", fallbackReason: null, rows: [], totalKrw: null,
});
let client: QueryClient;
let frameId: number;
let frames: Map<number, FrameRequestCallback>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRowRenders.length = 0;
  frameId = 0;
  frames = new Map();
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => { if (id != null) frames.delete(id); });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  jest.mocked(getChatHistory).mockResolvedValue(initialHistory);
  jest.mocked(getPendingTransactions).mockResolvedValue({ items: [], nextCursor: null });
  jest.mocked(sendChatMessage).mockImplementation(() => new Promise(() => {}));
});

afterEach(async () => {
  await cleanup();
  client.clear();
  jest.restoreAllMocks();
});

async function flushFrame() {
  await act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  });
}

async function contentSize(height: number) {
  await act(() => mockListProps.onContentSizeChange?.(360, height));
}

async function viewport(height = 500) {
  await act(() => mockListProps.onLayout?.({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } } as Parameters<NonNullable<typeof mockListProps.onLayout>>[0]));
}

async function markerLayout() {
  await fireEvent(screen.getByTestId("chat-layout-marker"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 0 } } });
}

async function renderChat(history = initialHistory) {
  jest.mocked(getChatHistory).mockResolvedValue(history);
  const result = await render(<QueryClientProvider client={client}><CoachingChatScreen /></QueryClientProvider>);
  await screen.findByTestId("coaching-chat-list");
  await waitFor(() => expect(client.isFetching()).toBe(0));
  return result;
}

async function openChat() {
  const result = await renderChat();
  await viewport();
  await contentSize(1000);
  await markerLayout();
  await flushFrame();
  mockScrollToOffset.mockClear();
  return result;
}

async function submit() {
  await fireEvent.changeText(screen.getByLabelText(CHAT_INPUT_LABEL), question);
  await fireEvent.press(screen.getByRole("button", { name: SEND_LABEL }));
  await screen.findByText(THINKING_LABEL);
}

function rowKeys() {
  return Array.from(mockListProps.data ?? []).map((row) => row.key);
}

it("최초 진입은 콘텐츠와 표시 영역 및 해당 렌더의 배치를 기다려 한 번 이동한다", async () => {
  await renderChat();
  await contentSize(1000);
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
  await viewport();
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
  await markerLayout();
  await contentSize(1200);
  await contentSize(1400);
  await flushFrame();
  expect(mockScrollToOffset.mock.calls).toEqual([[{ offset: 900, animated: false }]]);
  await contentSize(1500);
  await flushFrame();
  expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  expect(mockScrollToEnd).not.toHaveBeenCalled();
});

it("빈 이력과 화면보다 작은 콘텐츠는 음수 위치로 이동하지 않는다", async () => {
  await renderChat(EMPTY_CHAT_HISTORY);
  await viewport();
  await contentSize(200);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
});

it("질문 전송 후 새 배치에서만 하단으로 이동하고 답변 수신과 입력 초기화는 이동시키지 않는다", async () => {
  const response = deferred<ChatReply>();
  jest.mocked(sendChatMessage).mockReturnValue(response.promise);
  await openChat();
  await submit();
  const pendingKeys = rowKeys();
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
  await contentSize(1150);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset.mock.calls).toEqual([[{ offset: 650, animated: false }]]);
  await act(() => response.resolve(reply));
  await screen.findByText(reply.reply);
  expect(rowKeys()).toEqual(pendingKeys);
  expect(screen.getAllByText(question)).toHaveLength(1);
  expect(screen.getByLabelText(CHAT_INPUT_LABEL)).toHaveProp("value", "");
  await contentSize(2200);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  expect(client.getQueryData<ChatHistory>(coachingKeys.chat())?.messages).toHaveLength(4);
  expect(mockRowRenders.every((rows) => rows.length <= 4 && new Set(rows.map((row) => row.key)).size === rows.length)).toBe(true);
});

it.each(["배치 전", "예약 후"])("빠른 응답(%s)은 전송 때 예약한 이동을 취소한다", async (timing) => {
  const response = deferred<ChatReply>();
  jest.mocked(sendChatMessage).mockReturnValue(response.promise);
  await openChat();
  await submit();
  if (timing === "예약 후") {
    await contentSize(1150);
    await markerLayout();
  }
  await act(() => response.resolve(reply));
  await screen.findByText(reply.reply);
  await contentSize(2200);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it("캐시가 먼저 갱신되어도 임시 질문을 중복 표시하거나 예약된 이동을 실행하지 않는다", async () => {
  await openChat();
  await submit();
  const pendingKeys = rowKeys();
  await contentSize(1150);
  await markerLayout();
  // mutation은 여전히 pending인 채, useSendChatMessage.onSuccess가 먼저 캐시를 갱신하는 순서를 재현한다.
  await act(() => client.setQueryData(coachingKeys.chat(), appendChatTurn(initialHistory, question, reply)));
  expect(rowKeys()).toEqual(pendingKeys);
  expect(screen.getAllByText(question)).toHaveLength(1);
  expect(screen.queryByText(THINKING_LABEL)).toBeNull();
  await contentSize(2200);
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it("실패 시 위치와 키를 유지하고 같은 높이의 재시도도 한 번만 이동한다", async () => {
  const first = deferred<ChatReply>();
  const second = deferred<ChatReply>();
  jest.mocked(sendChatMessage).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await openChat();
  await submit();
  const pendingKeys = rowKeys();
  await contentSize(1150);
  await markerLayout();
  await act(() => first.reject(new ApiError(503, "AI_001", "코치가 잠시 자리를 비웠어요.")));
  await screen.findByRole("button", { name: "다시 시도" });
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
  expect(rowKeys()).toEqual(pendingKeys);
  expect(screen.getByLabelText(CHAT_INPUT_LABEL)).toHaveProp("value", question);
  await fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));
  await screen.findByText(THINKING_LABEL);
  await markerLayout(); // 크기가 같아 onContentSizeChange가 오지 않아도 처리한다.
  await flushFrame();
  expect(mockScrollToOffset.mock.calls).toEqual([[{ offset: 650, animated: false }]]);
  expect(rowKeys()).toEqual(pendingKeys);
  await act(() => second.resolve(reply));
  await screen.findByText(reply.reply);
  await contentSize(2200);
  await flushFrame();
  expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  expect(rowKeys()).toEqual(pendingKeys);
  expect(screen.getAllByText(question)).toHaveLength(1);
});

it("사용자가 드래그하면 대기 중인 이동을 취소하고 뒤이은 레이아웃에도 재개하지 않는다", async () => {
  await openChat();
  await submit();
  await contentSize(1150);
  await markerLayout();
  await act(() => mockListProps.onScrollBeginDrag?.({} as Parameters<NonNullable<typeof mockListProps.onScrollBeginDrag>>[0]));
  await contentSize(1200);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it("화면을 닫으면 예약된 프레임을 취소한다", async () => {
  const result = await openChat();
  await submit();
  await contentSize(1150);
  await markerLayout();
  expect(frames.size).toBeGreaterThan(0);
  const lateContentSizeChange = mockListProps.onContentSizeChange;
  await result.unmount();
  expect(frames.size).toBe(0);
  await act(() => lateContentSizeChange?.(360, 2000));
  expect(frames.size).toBe(0);
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it("표·차트가 있는 긴 답변과 키보드 크기 변화 및 차트 복귀는 추가 이동을 만들지 않는다", async () => {
  const response = deferred<ChatReply>();
  jest.mocked(sendChatMessage).mockReturnValue(response.promise);
  await openChat();
  await submit();
  await contentSize(1150);
  await markerLayout();
  await flushFrame();
  mockScrollToOffset.mockClear();
  const richReply: ChatReply = {
    ...reply, reply: "긴 답변\n".repeat(100), chartId: "chart1",
    rows: [{ envelope: "외식", totalKrw: "45000", count: 3 }], totalKrw: "45000",
    envelopeBalances: [{ envelope: "외식", balanceKrw: "35500" }],
    numericRows: { mode: "risk", envelopeSpend: [{ envelope: "외식", p10Krw: "10000", p50Krw: "20000", p90Krw: "30000" }], budgetRisk: [] },
  };
  await act(() => response.resolve(richReply));
  await screen.findByText(richReply.reply);
  await contentSize(5000);
  await contentSize(5200);
  await viewport(300);
  await viewport(500);
  await flushFrame();
  await fireEvent.press(screen.getByRole("button", { name: CHART_LINK_LABEL }));
  expect(mockPush).toHaveBeenCalledWith("/coaching/chart/chart1");
  await viewport(); // 같은 화면 인스턴스로 돌아오는 경우
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it("이력 재조회는 최초 진입 이동을 반복하지 않는다", async () => {
  await openChat();
  await act(() => client.setQueryData(coachingKeys.chat(), appendChatTurn(initialHistory, "다른 기기의 질문", reply)));
  await contentSize(1800);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});

it("여러 화면 분량의 이력에서도 측정 높이로 이동하고 후속 질문은 기존 키를 유지한다", async () => {
  let history = EMPTY_CHAT_HISTORY;
  for (let i = 0; i < 20; i++) history = appendChatTurn(history, `이전 질문 ${i}`, reply);
  await renderChat(history);
  await viewport(600);
  await contentSize(18000);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 17400, animated: false });
  const initialKeys = rowKeys();
  await submit();
  expect(rowKeys().slice(0, 40)).toEqual(initialKeys);
  expect(rowKeys().slice(40)).toEqual(["m-40", "m-41"]);
  await contentSize(18120);
  await markerLayout();
  await flushFrame();
  expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 17520, animated: false });
});

it("전송 직후 기존 차트를 열면 배경 화면의 예약된 이동도 취소한다", async () => {
  await renderChat(appendChatTurn(EMPTY_CHAT_HISTORY, "이전 차트 질문", { ...reply, chartId: "chart1" }));
  await viewport();
  await contentSize(1000);
  await markerLayout();
  await flushFrame();
  mockScrollToOffset.mockClear();
  await submit();
  await contentSize(1150);
  await markerLayout();
  await fireEvent.press(screen.getByRole("button", { name: CHART_LINK_LABEL }));
  await flushFrame();
  expect(mockPush).toHaveBeenCalledWith("/coaching/chart/chart1");
  expect(mockScrollToOffset).not.toHaveBeenCalled();
});
