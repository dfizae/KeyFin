import { furnitureListMock, placedFurnitureMock, resetFurnitureMocks, updateFurniturePlacementMock } from "@/api/mocks/furniture";
import {
  changedPlacements,
  statusOfSurface,
  surfaceOfStatus,
  toPlacement,
  toPlacementRequest,
  toPlacements,
  toUserFurnitures,
} from "@/features/room/furniture";
import type { PlacedFurnitureDto } from "@/features/room/model";
import { FURNITURE, type FurnitureId } from "@/features/room/catalog";
import { anchorToCell, cellAnchor, cellsOverlap } from "@/features/room/grid";
import { DEFAULT_LAYOUT, SURFACES, isPlaceableOnFloor, withDefaultWallItems, type Placement } from "@/features/room/scene";

const sofa: PlacedFurnitureDto = {
  userFurnitureId: 204,
  itemId: 4,
  slotType: "FLOOR",
  assetKey: "sofa_default",
  placementStatus: "FLOOR",
  placementDirection: "FRONT_RIGHT",
  positionX: 165,
  positionY: 280,
  layer: 0,
};

const board: PlacedFurnitureDto = {
  ...sofa,
  userFurnitureId: 205,
  assetKey: "board_default",
  slotType: "WALL",
  placementStatus: "RIGHT_WALL",
  positionX: 240,
  positionY: 90,
};

describe("설치 면 ↔ 씬 면", () => {
  it("서버 값과 씬 면을 양방향으로 옮긴다", () => {
    expect(surfaceOfStatus("LEFT_WALL")).toBe("WALL_LEFT");
    expect(surfaceOfStatus("RIGHT_WALL")).toBe("WALL_RIGHT");
    expect(surfaceOfStatus("FLOOR")).toBe("FLOOR");
    expect(surfaceOfStatus("CEILING")).toBeNull();

    expect(statusOfSurface("WALL_LEFT")).toBe("LEFT_WALL");
    expect(statusOfSurface(undefined)).toBe("FLOOR");
  });
});

describe("toPlacement — 서버 가구를 씬 배치로", () => {
  it("바닥 가구는 면 없이, 벽 가구는 자기 벽으로 놓는다", () => {
    expect(toPlacement(sofa)).toEqual({ itemId: "sofa", userFurnitureId: 204, anchor: { x: 165, y: 280 }, layer: 0 });
    expect(toPlacement(board)).toEqual({
      itemId: "board",
      userFurnitureId: 205,
      anchor: { x: 240, y: 90 },
      layer: 0,
      surface: "WALL_RIGHT",
    });
  });

  it("그릴 수 없는 항목은 null 이다 — 모르는 assetKey · 면 불일치 · 씬 밖 좌표", () => {
    expect(toPlacement({ ...sofa, assetKey: "sofa_blue" })).toBeNull();
    expect(toPlacement({ ...sofa, placementStatus: "RIGHT_WALL" })).toBeNull();
    expect(toPlacement({ ...board, placementStatus: "FLOOR" })).toBeNull();
    expect(toPlacement({ ...sofa, positionY: 999 })).toBeNull();
  });

  it("목록은 그릴 수 있는 것만 남긴다", () => {
    expect(toPlacements([sofa, { ...board, assetKey: "unknown_key" }])).toHaveLength(1);
  });

  it("옛 방 좌표처럼 바닥 밖에 저장된 가구는 가장 가까운 빈 칸에 앉힌다", () => {
    const fridge: PlacedFurnitureDto = { ...sofa, userFurnitureId: 206, assetKey: "fridge_default", positionX: 170, positionY: 275 };
    const settled = toPlacements([sofa, fridge]);
    const cells = settled.map((placement) => anchorToCell(SURFACES.FLOOR, placement.anchor, FURNITURE[placement.itemId as FurnitureId].grid));

    expect(settled.map((placement) => placement.userFurnitureId)).toEqual([204, 206]);
    cells.forEach((cell, index) => {
      const footprint = FURNITURE[settled[index].itemId as FurnitureId].grid;
      expect(isPlaceableOnFloor(cell, footprint)).toBe(true);
      expect(settled[index].anchor).toEqual(cellAnchor(SURFACES.FLOOR, cell, footprint));
    });
    expect(cellsOverlap(cells[0], FURNITURE.sofa.grid, cells[1], FURNITURE.fridge.grid)).toBe(false);
  });

  it("이미 제자리인 가구는 그대로 둔다", () => {
    const anchor = cellAnchor(SURFACES.FLOOR, { col: 6, row: 4 }, FURNITURE.sofa.grid);

    expect(toPlacements([{ ...sofa, positionX: anchor.x, positionY: anchor.y }])[0].anchor).toEqual(anchor);
  });
});

describe("withDefaultWallItems — 서버에 없는 벽 오브젝트를 기본 자리에 채운다", () => {
  const sofaOnFloor: Placement = { itemId: "sofa", userFurnitureId: 204, anchor: cellAnchor(SURFACES.FLOOR, { col: 6, row: 4 }, FURNITURE.sofa.grid) };
  const defaultAnchor = (itemId: "board" | "calendar") => DEFAULT_LAYOUT.find((p) => p.itemId === itemId)!.anchor;

  it("보드·캘린더가 없으면 기본 자리에 더하고 서버 가구는 그대로 둔다", () => {
    const layout = withDefaultWallItems([sofaOnFloor]);

    expect(layout[0]).toEqual(sofaOnFloor);
    expect(layout.find((p) => p.itemId === "board")).toEqual({ itemId: "board", surface: "WALL_RIGHT", anchor: defaultAnchor("board") });
    expect(layout.find((p) => p.itemId === "calendar")?.anchor).toEqual(defaultAnchor("calendar"));
  });

  it("서버에 있는 벽 오브젝트는 서버 자리를 쓰고 중복해 더하지 않는다", () => {
    const board: Placement = { itemId: "board", userFurnitureId: 205, surface: "WALL_RIGHT", anchor: defaultAnchor("calendar") };
    const layout = withDefaultWallItems([sofaOnFloor, board]);

    expect(layout.filter((p) => p.itemId === "board")).toEqual([board]);
    // 캘린더 기본 자리를 서버 보드가 차지했으므로 캘린더는 다른 칸으로 비킨다
    expect(layout.find((p) => p.itemId === "calendar")?.anchor).not.toEqual(defaultAnchor("calendar"));
  });
});

describe("toPlacementRequest — 씬 배치를 저장 요청으로", () => {
  it("면·방향·좌표를 채우고 좌표는 소수 3자리로 다듬는다", () => {
    const placement: Placement = { itemId: "sofa", userFurnitureId: 204, anchor: { x: 164.87512, y: 226 } };

    expect(toPlacementRequest(placement)).toEqual({
      placed: true,
      placementStatus: "FLOOR",
      placementDirection: "FRONT_RIGHT",
      positionX: 164.875,
      positionY: 226,
      layer: 0,
    });
  });

  it("씬 밖으로 나간 좌표는 경계로 당겨 400 을 피한다", () => {
    const request = toPlacementRequest({ itemId: "plant", anchor: { x: -5, y: 700 } });

    expect(request).toMatchObject({ positionX: 0, positionY: 586 });
  });
});

describe("changedPlacements — 옮긴 것만 보낸다", () => {
  const before: Placement[] = [
    { itemId: "sofa", userFurnitureId: 204, anchor: { x: 165, y: 280 } },
    { itemId: "plant", userFurnitureId: 203, anchor: { x: 40, y: 300 } },
  ];

  it("자리가 그대로면 보내지 않는다", () => {
    expect(changedPlacements(before, before)).toEqual([]);
  });

  it("움직인 가구만 골라 요청을 만든다", () => {
    const after = before.map((placement) => (placement.itemId === "sofa" ? { ...placement, anchor: { x: 130, y: 300 } } : placement));
    const saves = changedPlacements(before, after);

    expect(saves).toHaveLength(1);
    expect(saves[0].userFurnitureId).toBe(204);
    expect(saves[0].request).toMatchObject({ placed: true, positionX: 130, positionY: 300 });
  });

  it("서버에 없는 기본 배치(userFurnitureId 없음)는 건너뛴다", () => {
    const fallback: Placement[] = [{ itemId: "desk", anchor: { x: 10, y: 200 } }];
    const moved: Placement[] = [{ itemId: "desk", anchor: { x: 20, y: 210 } }];

    expect(changedPlacements(fallback, moved)).toEqual([]);
  });
});

describe("가구 목 — 서버처럼 상태를 지킨다", () => {
  afterEach(() => resetFurnitureMocks());

  it("보유 목록은 기본 배치를 그대로 주고 slotType 으로 거른다", () => {
    expect(furnitureListMock()).toHaveLength(6);
    expect(furnitureListMock("WALL").map((item) => item.assetKey)).toEqual(["board_default", "calendar_default"]);
    expect(toUserFurnitures(furnitureListMock("WALL"))[0]).toMatchObject({ itemId: "board", placed: true });
  });

  it("배치를 바꾸면 방 응답에도 반영되고, 해제하면 목록에서 빠진다", () => {
    const sofaId = furnitureListMock().find((item) => item.assetKey === "sofa_default")!.userFurnitureId;

    const moved = cellAnchor(SURFACES.FLOOR, { col: 8, row: 8 }, FURNITURE.sofa.grid);

    updateFurniturePlacementMock(sofaId, {
      placed: true,
      placementStatus: "FLOOR",
      placementDirection: "FRONT_RIGHT",
      positionX: moved.x,
      positionY: moved.y,
      layer: 0,
    });
    expect(toPlacements(placedFurnitureMock()).find((placement) => placement.itemId === "sofa")?.anchor).toEqual(moved);

    updateFurniturePlacementMock(sofaId, { placed: false });
    expect(placedFurnitureMock().some((item) => item.assetKey === "sofa_default")).toBe(false);
    expect(toUserFurnitures(furnitureListMock()).find((item) => item.itemId === "sofa")).toMatchObject({ placed: false, placement: null });
  });
});
