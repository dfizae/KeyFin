import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { EDIT_LABEL, ROOM_EDIT_ROUTE, RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { EDIT_HINT, RoomEditScreen } from "@/features/room/components/RoomEditScreen";
import { DEFAULT_LAYOUT } from "@/features/room/scene";
import { useRoomStore } from "@/features/room/store";

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

describe("방 꾸미기 진입과 편집 화면", () => {
  beforeEach(() => {
    useRoomStore.setState({ layout: DEFAULT_LAYOUT, draft: null, selectedId: null });
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
    await render(<RoomEditScreen />);
    expect(screen.getByText(EDIT_HINT)).toBeTruthy();
    expect(useRoomStore.getState().draft).not.toBeNull();

    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 취소" }));
    expect(sofaAnchor()).toEqual(DEFAULT_LAYOUT.find((p) => p.itemId === "sofa")!.anchor);
    expect(useRoomStore.getState().draft).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("완료는 확정하고 돌아간다 — 벽 오브젝트도 같은 사본에서 옮긴다", async () => {
    await render(<RoomEditScreen />);
    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    useRoomStore.getState().moveItem("board", { x: 70, y: 80 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 완료" }));
    expect(sofaAnchor()).toEqual({ x: 130, y: 300 });
    expect(useRoomStore.getState().layout.find((p) => p.itemId === "board")!.anchor).toEqual({ x: 70, y: 80 });
    expect(useRoomStore.getState().draft).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("화면을 떠나면(언마운트) 남은 사본은 버린다", async () => {
    const view = await render(<RoomEditScreen />);
    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    await view.unmount();
    expect(useRoomStore.getState().draft).toBeNull();
    expect(sofaAnchor()).toEqual(DEFAULT_LAYOUT.find((p) => p.itemId === "sofa")!.anchor);
  });
});
