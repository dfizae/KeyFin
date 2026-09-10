import { Canvas, Group, Image as SkiaImage, Path, Skia, useImage } from "@shopify/react-native-skia";
import { useColorScheme } from "nativewind";
import * as React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue } from "react-native-reanimated";

import { CHARACTER_IDLE, ROOM_FLOOR } from "@/features/room/assets";
import { readCamera, useRoomCamera } from "@/features/room/camera";
import { FURNITURE, type FurnitureId, type FurnitureItem } from "@/features/room/catalog";
import {
  canvasPointToScene,
  depthIndexAt,
  depthKey,
  getCanvasSize,
  getSceneScale,
  getSpriteRect,
  hitTestTopmost,
  sceneRectToCanvas,
  sortByDepth,
  type ScenePoint,
  type SceneRect,
} from "@/features/room/model";
import {
  anchorToCell,
  cellAnchor,
  cellToScene,
  footprintOutline,
  halfSpan,
  isGridPlacementValid,
  snapToCell,
  HALF_PER_CELL,
  type GridCell,
  type GridFootprint,
  type GridPlacement,
} from "@/features/room/grid";
import {
  CHARACTER_MOTION,
  CHARACTER_SIZE,
  FLOOR_POLYGON,
  SURFACES,
  getFootprintPolygon,
  isPlaceableOnFloor,
  type Placement,
} from "@/features/room/scene";
import { selectIsEditing, selectPlacements, useRoomStore } from "@/features/room/store";
import { useCharacterWalker, type CharacterWalker } from "@/features/room/useCharacterWalker";
import { getColors } from "@/lib/theme";

// 바닥 1장 + 가구를 발끝 y 기준 painter's algorithm 으로 그리고, 캐릭터는 정렬된 가구 사이에 끼운다.
// 캐릭터는 매 프레임 움직이므로 JSX 를 재정렬하는 대신 캐릭터가 들어갈 위치(depthIndex)만 워크릿에서 계산해
// 그 값이 바뀔 때만 React 상태를 갱신한다(가구 경계를 넘을 때만 리렌더).
// 확대·이동: RoomView 가 가진 카메라(셰어드 값)를 최상위 Group transform 으로 걸어 씬을 통째로 옮긴다. 원본을 다시 그리므로 확대해도 선명하다.
// 편집 모드: 캔버스 위 Pan 제스처로 가구를 끌어 옮긴다. 끌리는 가구는 맨 앞에 그리고 위치는 셰어드 값으로 따라가며,
// 손을 떼면 스토어(draft)에 반영되고 정렬이 다시 계산된다.

const FLOOR_SURFACE = SURFACES.FLOOR;

type PlacedFurniture = Placement & { item: FurnitureItem; layer: number };

type RoomSceneProps = {
  /** 캔버스 폭(pt). 높이는 씬 비율로 정해진다. */
  width: number;
};

function RoomScene({ width }: RoomSceneProps) {
  const { height } = getCanvasSize(width);
  const scale = getSceneScale(width);
  const camera = useRoomCamera();
  const floor = useImage(ROOM_FLOOR);
  const { colorScheme } = useColorScheme();
  const themeColors = getColors(colorScheme);
  const cameraTransform = useDerivedValue(() => [{ translateX: camera.tx.value }, { translateY: camera.ty.value }, { scale: camera.scale.value }]);

  const placements = useRoomStore(selectPlacements);
  const isEditing = useRoomStore(selectIsEditing);
  const selectedId = useRoomStore((s) => s.selectedId);
  const select = useRoomStore((s) => s.select);
  const moveItem = useRoomStore((s) => s.moveItem);

  const sorted = React.useMemo<readonly PlacedFurniture[]>(
    () =>
      sortByDepth(
        placements.map((placement) => {
          const item = FURNITURE[placement.itemId];
          return { ...placement, item, layer: placement.layer ?? item.layer ?? 0 };
        })
      ),
    [placements]
  );
  const sortedKeys = React.useMemo(() => sorted.map(depthKey), [sorted]);
  const footprints = React.useMemo(() => sorted.map((p) => getFootprintPolygon(p.item, p.anchor)), [sorted]);
  // 자동 보행은 편집에 방해돼 꺼 뒀다(사용자 결정 2026-09-09). 제자리에서 호흡만 한다.
  const walker = useCharacterWalker({ polygon: FLOOR_POLYGON, blocked: footprints, walking: false });

  const [depthIndex, setDepthIndex] = React.useState(() => depthIndexAt(sortedKeys, CHARACTER_MOTION.start.y));
  useAnimatedReaction(
    () => depthIndexAt(sortedKeys, walker.y.value),
    (next, previous) => {
      if (next !== previous) runOnJS(setDepthIndex)(next);
    },
    [sortedKeys]
  );

  // 드래그 상태. draggingId 는 리렌더(그리기 순서)를 위해 React 상태, 위치는 매 프레임 갱신되므로 셰어드 값.
  const [draggingId, setDraggingId] = React.useState<FurnitureId | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  /** 놓을 수 있는 자리면 1. 겹치거나 바닥 밖이면 0 이 되어 반투명 + 빨간 칸으로 알린다. */
  const dragValid = useSharedValue(1);
  const dragStart = React.useRef<{ id: FurnitureId; from: GridCell; others: GridPlacement[] } | null>(null);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(isEditing)
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => {
          const point = canvasPointToScene({ x: event.x, y: event.y }, readCamera(camera), scale);
          const targets = sorted.map((p) => ({ id: p.itemId, rect: getSpriteRect(p.anchor, p.item.size, p.item.anchor) }));
          const id = hitTestTopmost(point, targets);
          select(id);
          if (!id) return;
          const placed = sorted.find((p) => p.itemId === id)!;
          dragStart.current = {
            id,
            from: anchorToCell(FLOOR_SURFACE, placed.anchor, placed.item.grid),
            others: sorted
              .filter((p) => p.itemId !== id)
              .map((p) => ({ cell: anchorToCell(FLOOR_SURFACE, p.anchor, p.item.grid), footprint: p.item.grid })),
          };
          dragX.value = placed.anchor.x;
          dragY.value = placed.anchor.y;
          dragValid.value = 1;
          setDraggingId(id);
        })
        .onUpdate((event) => {
          const start = dragStart.current;
          if (!start) return;
          // 손가락이 짚은 씬 좌표를 반 칸 자리로 스냅한다. 칸 단위라 확대 배율과 무관하게 같은 자리에 붙는다.
          // 막힌 자리로 미끄러뜨리지 않고 짚은 칸을 그대로 보여준 뒤, 놓을 수 없으면 그렇게 표시한다.
          const dragScale = scale * camera.scale.value;
          const footprint = FURNITURE[start.id].grid;
          const origin = cellAnchor(FLOOR_SURFACE, start.from, footprint);
          const cell = snapToCell(
            FLOOR_SURFACE,
            { x: origin.x + event.translationX / dragScale, y: origin.y + event.translationY / dragScale },
            footprint
          );
          const anchor = cellAnchor(FLOOR_SURFACE, cell, footprint);
          dragX.value = anchor.x;
          dragY.value = anchor.y;
          dragValid.value = isGridPlacementValid(FLOOR_SURFACE, cell, footprint, start.others, (candidate) =>
            isPlaceableOnFloor(candidate, footprint)
          )
            ? 1
            : 0;
        })
        .onFinalize(() => {
          const start = dragStart.current;
          if (!start) return;
          // 놓을 수 없는 자리면 옮기지 않는다. 가구는 원래 칸으로 되돌아간다.
          if (dragValid.value) moveItem(start.id, { x: dragX.value, y: dragY.value });
          dragStart.current = null;
          setDraggingId(null);
          dragValid.value = 1;
        }),
    [isEditing, scale, camera, sorted, select, moveItem, dragX, dragY, dragValid]
  );

  React.useEffect(() => {
    if (!isEditing) setDraggingId(null);
  }, [isEditing]);

  const dragging = draggingId ? sorted.find((p) => p.itemId === draggingId) ?? null : null;
  const stationary = dragging ? sorted.filter((p) => p.itemId !== draggingId) : sorted;
  const behind = stationary.slice(0, Math.min(depthIndex, stationary.length));
  const inFront = stationary.slice(behind.length);
  const highlightId = draggingId ?? (isEditing ? selectedId : null);

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height }} collapsable={false}>
        <Canvas style={{ width, height }}>
          <Group transform={cameraTransform}>
            {floor ? <SkiaImage image={floor} x={0} y={0} width={width} height={height} fit="cover" /> : null}
            {isEditing ? <GridOverlay scale={scale} color={themeColors.white} /> : null}
            {behind.map((placed) => (
              <FurnitureSprite key={placed.itemId} placed={placed} scale={scale} highlighted={placed.itemId === highlightId} ringColor={themeColors.primary} />
            ))}
            <CharacterSprite walker={walker} scale={scale} />
            {inFront.map((placed) => (
              <FurnitureSprite key={placed.itemId} placed={placed} scale={scale} highlighted={placed.itemId === highlightId} ringColor={themeColors.primary} />
            ))}
            {dragging ? (
              <DraggingSprite
                placed={dragging}
                scale={scale}
                anchorX={dragX}
                anchorY={dragY}
                valid={dragValid}
                ringColor={themeColors.primary}
                blockedColor={themeColors.destructive}
              />
            ) : null}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

type GridOverlayProps = { scale: number; color: string };

/**
 * 편집 모드에서 바닥 칸을 보여준다. 배치 단위는 반 칸이지만 선은 칸 단위로만 그린다.
 * 반 칸까지 그리면 선이 두 배가 되어 바닥이 읽히지 않는다.
 * 격자는 화면 밖까지 뻗어 있으므로 보이는 바닥 모양으로 잘라낸다.
 */
function GridOverlay({ scale, color }: GridOverlayProps) {
  const { lines, floor } = React.useMemo(() => {
    const { cols, rows } = halfSpan(FLOOR_SURFACE);
    const grid = Skia.Path.Make();
    const addLine = (from: ScenePoint, to: ScenePoint) => {
      grid.moveTo(from.x * scale, from.y * scale);
      grid.lineTo(to.x * scale, to.y * scale);
    };
    for (let col = 0; col <= cols; col += HALF_PER_CELL) {
      addLine(cellToScene(FLOOR_SURFACE, { col, row: 0 }), cellToScene(FLOOR_SURFACE, { col, row: rows }));
    }
    for (let row = 0; row <= rows; row += HALF_PER_CELL) {
      addLine(cellToScene(FLOOR_SURFACE, { col: 0, row }), cellToScene(FLOOR_SURFACE, { col: cols, row }));
    }

    const outline = Skia.Path.Make();
    FLOOR_POLYGON.forEach((point, index) => {
      const x = point.x * scale;
      const y = point.y * scale;
      if (index === 0) outline.moveTo(x, y);
      else outline.lineTo(x, y);
    });
    outline.close();

    return { lines: grid, floor: outline };
  }, [scale]);

  return (
    <Group clip={floor}>
      <Path path={floor} style="fill" color={color} opacity={0.1} />
      <Path path={lines} style="stroke" strokeWidth={1.5} color={color} opacity={0.55} />
    </Group>
  );
}

/** 발자국이 놓이는 칸을 격자 모양(평행사변형) 그대로 그린다. origin 을 주면 그 발끝 위치로 옮겨 만든다. */
function outlinePath(footprint: GridFootprint, scale: number, origin: ScenePoint = { x: 0, y: 0 }) {
  const path = Skia.Path.Make();
  footprintOutline(FLOOR_SURFACE, footprint).forEach((point, index) => {
    const x = (origin.x + point.x) * scale;
    const y = (origin.y + point.y) * scale;
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  path.close();
  return path;
}

type FurnitureSpriteProps = { placed: PlacedFurniture; scale: number; highlighted?: boolean; ringColor: string };

function FurnitureSprite({ placed, scale, highlighted = false, ringColor }: FurnitureSpriteProps) {
  const image = useImage(placed.item.sprite);
  const rect = React.useMemo(
    () => sceneRectToCanvas(getSpriteRect(placed.anchor, placed.item.size, placed.item.anchor), scale),
    [placed, scale]
  );
  const ring = React.useMemo(
    () => outlinePath(placed.item.grid, scale, placed.anchor),
    [placed, scale]
  );
  if (!image) return null;
  return (
    <>
      {highlighted ? (
        <Group>
          <Path path={ring} style="fill" color={ringColor} opacity={0.18} />
          <Path path={ring} style="stroke" strokeWidth={2} color={ringColor} opacity={0.9} />
        </Group>
      ) : null}
      <SkiaImage image={image} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fit="contain" />
    </>
  );
}

type DraggingSpriteProps = {
  placed: PlacedFurniture;
  scale: number;
  anchorX: { value: number };
  anchorY: { value: number };
  /** 1 이면 놓을 수 있는 자리, 0 이면 막힌 자리 */
  valid: { value: number };
  ringColor: string;
  blockedColor: string;
};

/** 끌리는 동안의 가구. 위치는 셰어드 값에서 매 프레임 읽고, 놓일 칸을 격자 모양 그대로 깔아 보여준다. */
function DraggingSprite({ placed, scale, anchorX, anchorY, valid, ringColor, blockedColor }: DraggingSpriteProps) {
  const image = useImage(placed.item.sprite);
  const { item } = placed;
  const rect = useDerivedValue(() =>
    sceneRectToCanvas(getSpriteRect({ x: anchorX.value, y: anchorY.value }, item.size, item.anchor), scale)
  );
  const x = useDerivedValue(() => rect.value.x);
  const y = useDerivedValue(() => rect.value.y);
  const ring = React.useMemo(() => outlinePath(item.grid, scale), [item, scale]);
  const ringTransform = useDerivedValue(() => [
    { translateX: anchorX.value * scale },
    { translateY: anchorY.value * scale },
  ]);
  const okFill = useDerivedValue(() => (valid.value ? 0.22 : 0));
  const okLine = useDerivedValue(() => (valid.value ? 0.95 : 0));
  const blockedFill = useDerivedValue(() => (valid.value ? 0 : 0.28));
  const blockedLine = useDerivedValue(() => (valid.value ? 0 : 0.95));
  const spriteOpacity = useDerivedValue(() => (valid.value ? 0.9 : 0.3));
  if (!image) return null;
  return (
    <>
      <Group transform={ringTransform}>
        <Path path={ring} style="fill" color={ringColor} opacity={okFill} />
        <Path path={ring} style="stroke" strokeWidth={2} color={ringColor} opacity={okLine} />
        <Path path={ring} style="fill" color={blockedColor} opacity={blockedFill} />
        <Path path={ring} style="stroke" strokeWidth={2} color={blockedColor} opacity={blockedLine} />
      </Group>
      <SkiaImage
        image={image}
        x={x}
        y={y}
        width={item.size.width * scale}
        height={item.size.height * scale}
        fit="contain"
        opacity={spriteOpacity}
      />
    </>
  );
}

type CharacterSpriteProps = { walker: CharacterWalker; scale: number };

/**
 * 정지 이미지 한 장으로 움직이는 느낌을 낸다.
 * - 이동 중: 잔걸음 바운스(발끝 y 를 살짝 들었다 놓음), 진행 방향으로 미러링
 * - 정지 중: 호흡(발끝을 고정한 채 세로로 아주 조금 늘었다 줄어듦)
 */
function CharacterSprite({ walker, scale }: CharacterSpriteProps) {
  const image = useImage(CHARACTER_IDLE);
  const { x, y, facing, moving, bobPhase, breathPhase } = walker;

  const rect = useDerivedValue(() => {
    const bob = moving.value ? Math.sin(bobPhase.value * Math.PI) * CHARACTER_MOTION.bob.height : 0;
    const breath = moving.value ? 0 : (breathPhase.value - 0.5) * 2 * CHARACTER_MOTION.breath.amount;
    const size = { width: CHARACTER_SIZE.width * (1 - breath * 0.5), height: CHARACTER_SIZE.height * (1 + breath) };
    return sceneRectToCanvas(getSpriteRect({ x: x.value, y: y.value - bob }, size), scale);
  });
  const left = useDerivedValue(() => rect.value.x);
  const top = useDerivedValue(() => rect.value.y);
  const spriteWidth = useDerivedValue(() => rect.value.width);
  const spriteHeight = useDerivedValue(() => rect.value.height);
  const flip = useDerivedValue(() => [{ scaleX: facing.value }]);
  const origin = useDerivedValue(() => ({ x: x.value * scale, y: 0 }));

  if (!image) return null;
  return (
    <Group transform={flip} origin={origin}>
      <SkiaImage image={image} x={left} y={top} width={spriteWidth} height={spriteHeight} fit="contain" />
    </Group>
  );
}

export default RoomScene;
export { RoomScene };
export type { RoomSceneProps };
