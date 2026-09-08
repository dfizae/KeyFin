import { create } from "zustand";

import type { FurnitureId } from "@/features/room/catalog";
import type { ScenePoint } from "@/features/room/model";
import { DEFAULT_LAYOUT, type Placement } from "@/features/room/scene";

/**
 * 방 배치 상태.
 * - layout: 확정된 배치. 3단계에서 서버(GET/PUT /room/layout)와 동기화하며 TanStack Query 캐시로 옮긴다. (TBD)
 * - draft: 편집 모드에서 만지는 사본. 취소하면 버리고, 완료하면 layout 이 된다.
 * 편집 중 상태만 클라이언트 상태로 남기는 것이 최종 형태이며, 지금은 서버가 없어 layout 도 여기 둔다.
 */
export type RoomState = {
  layout: readonly Placement[];
  draft: readonly Placement[] | null;
  selectedId: FurnitureId | null;
  startEdit: () => void;
  cancelEdit: () => void;
  commitEdit: () => void;
  select: (id: FurnitureId | null) => void;
  moveItem: (id: FurnitureId, anchor: ScenePoint) => void;
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
  moveItem: (id, anchor) =>
    set((state) => {
      if (!state.draft) return state;
      return { draft: state.draft.map((p) => (p.itemId === id ? { ...p, anchor: { x: anchor.x, y: anchor.y } } : p)) };
    }),
}));

/** 화면이 그릴 배치: 편집 중이면 사본, 아니면 확정본 */
export const selectPlacements = (state: RoomState): readonly Placement[] => state.draft ?? state.layout;
export const selectIsEditing = (state: RoomState): boolean => state.draft !== null;
