import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { EDIT_HINT, EDIT_LABEL, RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { DEFAULT_LAYOUT } from "@/features/room/scene";
import { useRoomStore } from "@/features/room/store";

describe("RoomEditorOverlay", () => {
  beforeEach(() => {
    useRoomStore.setState({ layout: DEFAULT_LAYOUT, draft: null, selectedId: null });
  });

  it("꾸미기를 누르면 편집 모드로 들어가 안내와 취소·완료가 보인다", async () => {
    await render(<RoomEditorOverlay />);
    expect(screen.queryByText(EDIT_HINT)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: EDIT_LABEL }));
    expect(screen.getByText(EDIT_HINT)).toBeTruthy();
    expect(screen.getByRole("button", { name: "편집 취소" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "편집 완료" })).toBeTruthy();
    expect(useRoomStore.getState().draft).not.toBeNull();
  });

  it("취소는 옮긴 것을 버리고, 완료는 확정한다", async () => {
    await render(<RoomEditorOverlay />);
    await fireEvent.press(screen.getByRole("button", { name: EDIT_LABEL }));
    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 취소" }));
    expect(useRoomStore.getState().layout.find((p) => p.itemId === "sofa")!.anchor).toEqual({ x: 100, y: 284 });
    expect(screen.getByRole("button", { name: EDIT_LABEL })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: EDIT_LABEL }));
    useRoomStore.getState().moveItem("sofa", { x: 130, y: 300 });
    await fireEvent.press(screen.getByRole("button", { name: "편집 완료" }));
    expect(useRoomStore.getState().layout.find((p) => p.itemId === "sofa")!.anchor).toEqual({ x: 130, y: 300 });
    expect(useRoomStore.getState().draft).toBeNull();
  });
});
