import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { resetFurnitureMocks } from "@/api/mocks/furniture";
import { EDIT_LABEL, ROOM_EDIT_ROUTE, RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { EDIT_HINT, EDIT_ROOM_AREA_TEST_ID, RoomEditScreen, STORAGE_TITLE } from "@/features/room/components/RoomEditScreen";
import { FURNITURE } from "@/features/room/catalog";
import { cellAnchor } from "@/features/room/grid";
import { DEFAULT_LAYOUT, SURFACES } from "@/features/room/scene";
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

/** 소파를 옮겨 놓는 자리. 드래그는 칸에만 놓이므로 실제 칸의 기준점을 쓴다 (111.625, 538) */
const SOFA_MOVED = cellAnchor(SURFACES.FLOOR, { col: 8, row: 10 }, FURNITURE.sofa_default.grid);

const sofaAnchor = () => useRoomStore.getState().layout.find((p) => p.itemId === "sofa_default")!.anchor;

/** 편집 화면은 GET /room 으로 서버 배치를 받고 나서 사본을 뜬다. 목이 기본 배치를 그대로 주므로 자리는 같다 */
function renderEditScreen(props: { openStorage?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RoomEditScreen {...props} />
    </QueryClientProvider>
  );
}

async function renderEditing(props: { openStorage?: boolean } = {}) {
  const view = renderEditScreen(props);
  await waitFor(() => expect(useRoomStore.getState().draft).not.toBeNull());
  return view;
}

/** 말풍선은 방 크기를 잰 뒤에만 뜬다. 테스트에는 실제 레이아웃이 없어 크기를 흘려 넣는다 */
async function layoutRoomArea() {
  await fireEvent(screen.getByTestId(EDIT_ROOM_AREA_TEST_ID), "layout", { nativeEvent: { layout: { width: 327, height: 586 } } });
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

    useRoomStore.getState().moveItem("sofa_default", SOFA_MOVED);
    // 취소는 헤더의 뒤로가기다(2026-09-21 — 방을 크게 쓰려고 하단 취소/완료 줄을 없앴다)
    expect(screen.queryByRole("button", { name: "편집 취소" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "뒤로" }));
    expect(sofaAnchor()).toEqual(DEFAULT_LAYOUT.find((p) => p.itemId === "sofa_default")!.anchor);
    expect(useRoomStore.getState().draft).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("완료는 옮긴 가구를 서버에 저장한 뒤 확정하고 돌아간다 — 벽 오브젝트도 같은 사본에서 옮긴다", async () => {
    await renderEditing();
    useRoomStore.getState().moveItem("sofa_default", SOFA_MOVED);
    useRoomStore.getState().moveItem("board", { x: 70, y: 80 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 완료" }));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(sofaAnchor()).toEqual(SOFA_MOVED);
    expect(useRoomStore.getState().layout.find((p) => p.itemId === "board")!.anchor).toEqual({ x: 70, y: 80 });
    expect(useRoomStore.getState().draft).toBeNull();
  });

  it("옮긴 자리는 서버 목에 남아 다시 들어와도 그대로다", async () => {
    const first = await renderEditing();
    useRoomStore.getState().moveItem("sofa_default", SOFA_MOVED);
    await fireEvent.press(screen.getByRole("button", { name: "편집 완료" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await first.unmount();

    useRoomStore.setState({ layout: DEFAULT_LAYOUT, draft: null, selectedId: null });
    await renderEditing();
    await waitFor(() => expect(sofaAnchor()).toEqual(SOFA_MOVED), { timeout: 3000 });
  });

  it("보관함은 접혀 있다가 손잡이를 누르면 올라오고, 가구를 꺼내면 방에 놓이며 다시 내려간다", async () => {
    await renderEditing();
    const handle = await screen.findByRole("button", { name: /^보관함 열기, \d+개$/ });
    expect(screen.queryByRole("header", { name: STORAGE_TITLE })).toBeNull();

    await fireEvent.press(handle);
    expect(await screen.findByRole("header", { name: STORAGE_TITLE })).toBeTruthy();

    const before = useRoomStore.getState().draft?.length ?? 0;
    const tiles = await screen.findAllByRole("button", { name: /, 방에 놓기$/ });
    expect(tiles.length).toBeGreaterThan(1);
    await fireEvent.press(tiles[0]);
    expect(useRoomStore.getState().draft?.length).toBe(before + 1);
    await waitFor(() => expect(screen.queryByRole("header", { name: STORAGE_TITLE })).toBeNull());
  });

  it("상점에서 가구를 사고 넘어오면 보관함을 펴 둔 채로 연다", async () => {
    await renderEditing({ openStorage: true });
    expect(await screen.findByRole("header", { name: STORAGE_TITLE })).toBeTruthy();
  });

  it("가구를 고르면 그 옆에 동작 버튼이 뜨고, 기본 가구는 넣어 둘 수 없다고 알려 준다", async () => {
    await renderEditing();
    await layoutRoomArea();
    expect(screen.queryByRole("button", { name: /방향 바꾸기$/ })).toBeNull();

    await act(async () => useRoomStore.getState().select("sofa_default"));
    expect(await screen.findByRole("button", { name: /방향 바꾸기$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /넣어 두기$/ }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText("기본 가구는 넣어 둘 수 없어요.")).toBeTruthy();
    // 가구를 고른 동안에는 사용법 안내를 치운다 — 방을 가리는 글을 하나라도 줄인다
    expect(screen.queryByText(EDIT_HINT)).toBeNull();
  });

  it("화면을 떠나면(언마운트) 남은 사본은 버린다", async () => {
    const view = await renderEditing();
    useRoomStore.getState().moveItem("sofa_default", SOFA_MOVED);
    await view.unmount();
    expect(useRoomStore.getState().draft).toBeNull();
    expect(sofaAnchor()).toEqual(DEFAULT_LAYOUT.find((p) => p.itemId === "sofa_default")!.anchor);
  });
});
