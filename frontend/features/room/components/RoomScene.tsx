import { Canvas, Group, Image as SkiaImage, Oval, useImage } from "@shopify/react-native-skia";
import { useColorScheme } from "nativewind";
import * as React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue } from "react-native-reanimated";

import { CHARACTER_IDLE, ROOM_FLOOR } from "@/features/room/assets";
import { FURNITURE, type FurnitureId, type FurnitureItem } from "@/features/room/catalog";
import {
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
import { CHARACTER_MOTION, CHARACTER_SIZE, FLOOR_POLYGON, getFootprintRect, resolveDrag, type Placement } from "@/features/room/scene";
import { selectIsEditing, selectPlacements, useRoomStore } from "@/features/room/store";
import { useCharacterWalker, type CharacterWalker } from "@/features/room/useCharacterWalker";
import { getColors } from "@/lib/theme";

// 바닥 1장 + 가구를 발끝 y 기준 painter's algorithm 으로 그리고, 캐릭터는 정렬된 가구 사이에 끼운다.
// 캐릭터는 매 프레임 움직이므로 JSX 를 재정렬하는 대신 캐릭터가 들어갈 위치(depthIndex)만 워크릿에서 계산해
// 그 값이 바뀔 때만 React 상태를 갱신한다(가구 경계를 넘을 때만 리렌더).
// 편집 모드: 캔버스 위 Pan 제스처로 가구를 끌어 옮긴다. 끌리는 가구는 맨 앞에 그리고 위치는 셰어드 값으로 따라가며,
// 손을 떼면 스토어(draft)에 반영되고 정렬이 다시 계산된다.

type PlacedFurniture = Placement & { item: FurnitureItem; layer: number };

type RoomSceneProps = {
  /** 캔버스 폭(pt). 높이는 씬 비율로 정해진다. */
  width: number;
};

function RoomScene({ width }: RoomSceneProps) {
  const { height } = getCanvasSize(width);
  const scale = getSceneScale(width);
  const floor = useImage(ROOM_FLOOR);
  const { colorScheme } = useColorScheme();
  const themeColors = getColors(colorScheme);

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
  const footprints = React.useMemo(() => sorted.map((p) => getFootprintRect(p.item, p.anchor)), [sorted]);
  const walker = useCharacterWalker({ polygon: FLOOR_POLYGON, blocked: footprints });

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
  const dragStart = React.useRef<{ id: FurnitureId; from: ScenePoint; others: SceneRect[] } | null>(null);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(isEditing)
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => {
          const point = { x: event.x / scale, y: event.y / scale };
          const targets = sorted.map((p) => ({ id: p.itemId, rect: getSpriteRect(p.anchor, p.item.size, p.item.anchor) }));
          const id = hitTestTopmost(point, targets);
          select(id);
          if (!id) return;
          const placed = sorted.find((p) => p.itemId === id)!;
          dragStart.current = {
            id,
            from: placed.anchor,
            others: sorted.filter((p) => p.itemId !== id).map((p) => getFootprintRect(p.item, p.anchor)),
          };
          dragX.value = placed.anchor.x;
          dragY.value = placed.anchor.y;
          setDraggingId(id);
        })
        .onUpdate((event) => {
          const start = dragStart.current;
          if (!start) return;
          const next = resolveDrag(
            { item: FURNITURE[start.id], otherFootprints: start.others },
            start.from,
            { x: event.translationX / scale, y: event.translationY / scale }
          );
          dragX.value = next.x;
          dragY.value = next.y;
        })
        .onFinalize(() => {
          const start = dragStart.current;
          if (!start) return;
          moveItem(start.id, { x: dragX.value, y: dragY.value });
          dragStart.current = null;
          setDraggingId(null);
        }),
    [isEditing, scale, sorted, select, moveItem, dragX, dragY]
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
          {floor ? <SkiaImage image={floor} x={0} y={0} width={width} height={height} fit="cover" /> : null}
          {behind.map((placed) => (
            <FurnitureSprite key={placed.itemId} placed={placed} scale={scale} highlighted={placed.itemId === highlightId} ringColor={themeColors.primary} />
          ))}
          <CharacterSprite walker={walker} scale={scale} />
          {inFront.map((placed) => (
            <FurnitureSprite key={placed.itemId} placed={placed} scale={scale} highlighted={placed.itemId === highlightId} ringColor={themeColors.primary} />
          ))}
          {dragging ? (
            <DraggingSprite placed={dragging} scale={scale} anchorX={dragX} anchorY={dragY} ringColor={themeColors.primary} />
          ) : null}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

type FurnitureSpriteProps = { placed: PlacedFurniture; scale: number; highlighted?: boolean; ringColor: string };

function FurnitureSprite({ placed, scale, highlighted = false, ringColor }: FurnitureSpriteProps) {
  const image = useImage(placed.item.sprite);
  const rect = React.useMemo(
    () => sceneRectToCanvas(getSpriteRect(placed.anchor, placed.item.size, placed.item.anchor), scale),
    [placed, scale]
  );
  const ring = React.useMemo(() => sceneRectToCanvas(getFootprintRect(placed.item, placed.anchor), scale), [placed, scale]);
  if (!image) return null;
  return (
    <>
      {highlighted ? <Oval x={ring.x} y={ring.y} width={ring.width} height={ring.height} color={ringColor} opacity={0.25} /> : null}
      <SkiaImage image={image} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fit="contain" />
    </>
  );
}

type DraggingSpriteProps = {
  placed: PlacedFurniture;
  scale: number;
  anchorX: { value: number };
  anchorY: { value: number };
  ringColor: string;
};

/** 끌리는 동안의 가구. 위치는 셰어드 값에서 매 프레임 읽고, 발자국 자리에 반투명 타원을 깔아 어디에 놓일지 보여준다. */
function DraggingSprite({ placed, scale, anchorX, anchorY, ringColor }: DraggingSpriteProps) {
  const image = useImage(placed.item.sprite);
  const { item } = placed;
  const rect = useDerivedValue(() =>
    sceneRectToCanvas(getSpriteRect({ x: anchorX.value, y: anchorY.value }, item.size, item.anchor), scale)
  );
  const x = useDerivedValue(() => rect.value.x);
  const y = useDerivedValue(() => rect.value.y);
  const ring = useDerivedValue(() => sceneRectToCanvas(getFootprintRect(item, { x: anchorX.value, y: anchorY.value }), scale));
  const ringX = useDerivedValue(() => ring.value.x);
  const ringY = useDerivedValue(() => ring.value.y);
  const ringW = useDerivedValue(() => ring.value.width);
  const ringH = useDerivedValue(() => ring.value.height);
  if (!image) return null;
  return (
    <>
      <Oval x={ringX} y={ringY} width={ringW} height={ringH} color={ringColor} opacity={0.35} />
      <SkiaImage image={image} x={x} y={y} width={item.size.width * scale} height={item.size.height * scale} fit="contain" opacity={0.9} />
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
