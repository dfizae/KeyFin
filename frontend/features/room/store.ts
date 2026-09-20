import { create } from "zustand";

import type { RoomItemId } from "@/features/room/catalog";
import type { ScenePoint } from "@/features/room/model";
import { DEFAULT_LAYOUT, withDefaultWallItems, type Placement } from "@/features/room/scene";

/**
 * 방 배치 상태. 가구(바닥)와 벽 오브젝트(보드·캘린더)를 한 배열에 둔다.
 * - layout: 확정된 배치. 서버(GET /room 의 furnitures)를 받으면 hydrate 로 갈아 끼우고, 없으면 기본 배치를 그대로 둔다.
 * - draft: 편집 모드(방 꾸미기 화면)에서 만지는 사본. 취소하면 버리고, 완료하면 layout 이 된다.
 * 서버가 배치의 원천이고 여기 layout 은 씬이 매 프레임 읽는 사본이다 — 드래그 중 좌표를 쿼리 캐시에 쓰지 않으려고 스토어에 둔다.
 */
export type RoomState = {
  layout: readonly Placement[];
  draft: readonly Placement[] | null;
  selectedId: RoomItemId | null;
  startEdit: () => void;
  cancelEdit: () => void;
  commitEdit: () => void;
  select: (id: RoomItemId | null) => void;
  moveItem: (id: RoomItemId, anchor: ScenePoint) => void;
  /** 서버에서 받은 배치로 맞춘다. 편집 중이거나 설치된 가구가 없으면 지금 배치를 유지한다. 서버에 없는 벽 오브젝트는 기본 자리에 채운다 */
  hydrate: (placements: readonly Placement[]) => void;
};

export const useRoomStore = create<RoomState>((set, get) => ({
  layout: DEFAULT_LAYOUT,
  draft: null,
  selectedId: null,
  startEdit: () => set((state) => (state.draft ? state : { draft: state.layout.map((p) => ({ ...p })), selectedId: null })),
  cancelEdit: () => set({ draft: null, selectedId: null }),
  commitEdit: () => {
    const { draft } = get();
    if (!draft) return;
    set({ layout: draft, draft: null, selectedId: null });
  },
  select: (id) => set({ selectedId: id }),
  hydrate: (placements) =>
    set((state) => {
      if (state.draft !== null || placements.length === 0) return state;
      const layout = withDefaultWallItems(placements);
      if (samePlacements(state.layout, layout)) return state;
      return { layout };
    }),
  moveItem: (id, anchor) =>
    set((state) => {
      if (!state.draft) return state;
      return { draft: state.draft.map((p) => (p.itemId === id ? { ...p, anchor: { x: anchor.x, y: anchor.y } } : p)) };
    }),
}));

/** 화면이 그릴 배치: 편집 중이면 사본, 아니면 확정본 */
export const selectPlacements = (state: RoomState): readonly Placement[] => state.draft ?? state.layout;
export const selectIsEditing = (state: RoomState): boolean => state.draft !== null;

/** 셀렉터가 매번 새 배열을 만들면 무한 재렌더가 나므로, 같은 배치면 상태를 그대로 둔다 */
function samePlacements(left: readonly Placement[], right: readonly Placement[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((placement, index) => {
    const other = right[index];
    return (
      placement.itemId === other.itemId &&
      placement.userFurnitureId === other.userFurnitureId &&
      placement.surface === other.surface &&
      placement.layer === other.layer &&
      placement.anchor.x === other.anchor.x &&
      placement.anchor.y === other.anchor.y
    );
  });
}
