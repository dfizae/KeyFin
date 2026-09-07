import { Canvas, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import * as React from "react";
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { CHARACTER_IDLE, CHARACTER_SIZE, ROOM_FLOOR } from "@/features/room/assets";
import { getCanvasSize, getSceneScale, getSpriteRect, sceneRectToCanvas } from "@/features/room/model";

// 0단계 스파이크: 바닥 1장 + 정지 캐릭터 1장을 Skia 캔버스에 올리고, Reanimated 셰어드 값으로 좌우 왕복시킨다.
// 바닥 마름모 안쪽(씬 단위)만 오가도록 경로를 고정했다. 1단계에서 걷기 가능 폴리곤으로 대체한다.
const SPIKE_PATH = { fromX: 96, toX: 232, y: 340 };
const SPIKE_DURATION_MS = 4000;

type RoomSceneProps = {
  /** 캔버스 폭(pt). 높이는 씬 비율로 정해진다. */
  width: number;
};

function RoomScene({ width }: RoomSceneProps) {
  const { height } = getCanvasSize(width);
  const scale = getSceneScale(width);
  const floor = useImage(ROOM_FLOOR);
  const character = useImage(CHARACTER_IDLE);

  const anchorX = useSharedValue(SPIKE_PATH.fromX);
  React.useEffect(() => {
    anchorX.value = withRepeat(
      withTiming(SPIKE_PATH.toX, { duration: SPIKE_DURATION_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [anchorX]);

  const characterRect = useDerivedValue(() =>
    sceneRectToCanvas(getSpriteRect({ x: anchorX.value, y: SPIKE_PATH.y }, CHARACTER_SIZE), scale)
  );
  const characterX = useDerivedValue(() => characterRect.value.x);
  const characterY = useDerivedValue(() => characterRect.value.y);
  const characterWidth = CHARACTER_SIZE.width * scale;
  const characterHeight = CHARACTER_SIZE.height * scale;

  return (
    <Canvas style={{ width, height }}>
      {floor ? <SkiaImage image={floor} x={0} y={0} width={width} height={height} fit="cover" /> : null}
      {character ? (
        <SkiaImage image={character} x={characterX} y={characterY} width={characterWidth} height={characterHeight} fit="contain" />
      ) : null}
    </Canvas>
  );
}

export default RoomScene;
export { RoomScene };
export type { RoomSceneProps };
