import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { resetFurnitureMocks } from "@/api/mocks/furniture";
import { EDIT_LABEL, ROOM_EDIT_ROUTE, RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { EDIT_HINT, RoomEditScreen } from "@/features/room/components/RoomEditScreen";
import { DEFAULT_LAYOUT } from "@/features/room/scene";
import { useRoomStore } from "@/features/room/store";

// 목 응답이 act 범위 안에서 반영되도록 쿼리 알림을 그 자리에서 보낸다(HomeScreen 테스트와 같은 설정).
notifyManager.setScheduler((callback) => callback());

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react");
  return {
    useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
    useFocusEffect: (effect: () => void) => ReactActual.useEffect(effect, [effect]),
  };
});

const sofaAnchor = () => useRoomStore.getState().layout.find((p) => p.itemId === "sofa")!.anchor;

/** 편집 화면은 GET /room 으로 서버 배치를 받고 나서 사본을 뜬다. 목이 기본 배치를 그대로 주므로 자리는 같다 */
function renderEditScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RoomEditScreen />
    </QueryClientProvider>
  );
}

async function renderEditing() {
  const view = renderEditScreen();
  await waitFor(() => expect(useRoomStore.getState().draft).not.toBeNull());
  return view;
}

describe("방 꾸미기 진입과 편집 화면", () => {
  beforeEach(() => {
    useRoomStore.setState({ layout: DEFAULT_LAYOUT, draft: null, selectedId: null });
    resetFurnitureMocks();
    mockPush.mockReset();
    mockBack.mockReset();
  });

  it("홈의 꾸미기 버튼은 편집 화면으로 간다", async () => {
    await render(<RoomEditorOverlay />);
    await fireEvent.press(screen.getByRole("button", { name: EDIT_LABEL }));
    expect(mockPush).toHaveBeenCalledWith(ROOM_EDIT_ROUTE);
    expect(useRoomStore.getState().draft).toBeNull();
  });

  it("편집 화면에 들어오면 사본을 만들고, 취소는 옮긴 것을 버리고 돌아간다", async () => {
    await renderEditing();
    expect(screen.getByText(EDIT_HINT)).toBeTruthy();

    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 취소" }));
    expect(sofaAnchor()).toEqual(DEFAULT_LAYOUT.find((p) => p.itemId === "sofa")!.anchor);
    expect(useRoomStore.getState().draft).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("완료는 옮긴 가구를 서버에 저장한 뒤 확정하고 돌아간다 — 벽 오브젝트도 같은 사본에서 옮긴다", async () => {
    await renderEditing();
    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    useRoomStore.getState().moveItem("board", { x: 70, y: 80 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 완료" }));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(sofaAnchor()).toEqual({ x: 130, y: 300 });
    expect(useRoomStore.getState().layout.find((p) => p.itemId === "board")!.anchor).toEqual({ x: 70, y: 80 });
    expect(useRoomStore.getState().draft).toBeNull();
  });

  it("옮긴 자리는 서버 목에 남아 다시 들어와도 그대로다", async () => {
    const first = await renderEditing();
    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 완료" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await first.unmount();

    useRoomStore.setState({ layout: DEFAULT_LAYOUT, draft: null, selectedId: null });
    await renderEditing();
    await waitFor(() => expect(sofaAnchor()).toEqual({ x: 130, y: 300 }), { timeout: 3000 });
  });

  it("화면을 떠나면(언마운트) 남은 사본은 버린다", async () => {
    const view = await renderEditing();
    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    await view.unmount();
    expect(useRoomStore.getState().draft).toBeNull();
    expect(sofaAnchor()).toEqual(DEFAULT_LAYOUT.find((p) => p.itemId === "sofa")!.anchor);
  });
});
