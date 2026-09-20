import { useFocusEffect } from "expo-router";
import * as React from "react";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, runOnJS, useAnimatedReaction, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import {
  clampCamera,
  getCanvasSize,
  MAX_ZOOM,
  MIN_ZOOM,
  overflowsViewport,
  zoomAround,
  type Camera,
  type SceneSize,
} from "@/features/room/model";

/**
 * 방 씬을 확대·이동하는 카메라. 셰어드 값이라 Skia 캔버스(Group transform)와 RN 오버레이(Animated.View)가
 * React 리렌더 없이 매 프레임 같은 변환을 읽는다. 실제 변환 계산은 model.ts 의 순수 함수에 있다.
 */
export type RoomCamera = {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
};

const RESET_TIMING = { duration: 180 } as const;
/** 부동소수 오차로 1배를 확대 상태로 오인하지 않도록 둔 여유 */
const ZOOM_EPSILON = 0.001;

const RoomCameraContext = React.createContext<RoomCamera | null>(null);

export const RoomCameraProvider = RoomCameraContext.Provider;

/** 방 씬 안에서 카메라를 읽는다. RoomView 가 제공하므로 씬 밖에서는 쓸 수 없다. */
export function useRoomCamera(): RoomCamera {
  const camera = React.useContext(RoomCameraContext);
  if (!camera) throw new Error("useRoomCamera 는 RoomCameraProvider 안에서만 쓸 수 있다");
  return camera;
}

/** 셰어드 값 3개를 순수 함수에 넘길 형태로 읽는다. */
export function readCamera(camera: RoomCamera): Camera {
  "worklet";
  return { scale: camera.scale.value, tx: camera.tx.value, ty: camera.ty.value };
}

function resetCamera(camera: RoomCamera) {
  "worklet";
  if (camera.scale.value === MIN_ZOOM && camera.tx.value === 0 && camera.ty.value === 0) return;
  camera.scale.value = withTiming(MIN_ZOOM, RESET_TIMING);
  camera.tx.value = withTiming(0, RESET_TIMING);
  camera.ty.value = withTiming(0, RESET_TIMING);
}

function stopCamera(camera: RoomCamera) {
  "worklet";
  cancelAnimation(camera.scale);
  cancelAnimation(camera.tx);
  cancelAnimation(camera.ty);
}

type UseRoomCameraControlOptions = {
  /** 캔버스 폭(pt). 0 이면 아직 측정 전이라 제스처를 켜지 않는다 */
  width: number;
  /** 편집 모드·팝오버처럼 카메라를 1배로 고정해야 하는 상태 */
  locked: boolean;
  /** 확대 여부가 바뀔 때 알린다(부모 스크롤 잠금용). 참조가 안정적이어야 한다 */
  onZoomedChange?: (zoomed: boolean) => void;
  /** 실제로 보이는 영역(pt). 캔버스가 화면보다 넓은 홈에서 넘긴다. 생략하면 캔버스와 같다 */
  viewport?: SceneSize;
};

/**
 * 방 씬의 카메라와 제스처. 핀치는 두 손가락 중심을 고정한 채 1~2배로 확대하고 더블탭은 1배로 되돌린다.
 * 드래그는 ① 확대했을 때, 또는 ② 1배인데도 캔버스가 화면을 넘칠 때(홈의 cover 맞춤) 켠다 — 넘친 좌우를 볼 방법이 그것뿐이다.
 * 캔버스가 화면에 딱 맞는 화면(방 꾸미기)에서는 전과 같이 확대해야만 드래그된다.
 */
export function useRoomCameraControl({ width, locked, onZoomedChange, viewport }: UseRoomCameraControlOptions) {
  const scale = useSharedValue(MIN_ZOOM);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const camera = React.useMemo<RoomCamera>(() => ({ scale, tx, ty }), [scale, tx, ty]);

  const startScale = useSharedValue(MIN_ZOOM);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  const [zoomed, setZoomed] = React.useState(false);
  const handleZoomedChange = React.useCallback(
    (next: boolean) => {
      setZoomed(next);
      onZoomedChange?.(next);
    },
    [onZoomedChange]
  );

  useAnimatedReaction(
    () => scale.value > MIN_ZOOM + ZOOM_EPSILON,
    (next, previous) => {
      // 첫 실행(previous === null)은 초기값 통지라 건너뛴다.
      if (previous !== null && next !== previous) runOnJS(handleZoomedChange)(next);
    }
  );

  // 탭을 옮겨도 홈은 살아 있으므로, 화면을 벗어나면 1배로 되돌려 다음 진입이 항상 방 전체로 시작하게 한다.
  useFocusEffect(React.useCallback(() => () => resetCamera(camera), [camera]));

  // 잠금은 선언적인 상태인데 복귀는 명령형 애니메이션이라 여기서 맞춘다.
  React.useEffect(() => {
    if (locked) resetCamera(camera);
  }, [locked, camera]);

  // 객체를 그대로 의존성에 두면 매 렌더 새 참조라 제스처가 다시 만들어진다 — 숫자로 쪼개 둔다
  const viewportWidth = viewport?.width ?? 0;
  const viewportHeight = viewport?.height ?? 0;

  const gesture = React.useMemo(() => {
    const enabled = !locked && width > 0;
    const canvas = getCanvasSize(width);
    const view = viewportWidth > 0 && viewportHeight > 0 ? { width: viewportWidth, height: viewportHeight } : canvas;
    const overflows = overflowsViewport(canvas, view);

    const pinch = Gesture.Pinch()
      .enabled(enabled)
      .onStart(() => {
        stopCamera(camera);
        startScale.value = camera.scale.value;
      })
      .onUpdate((event) => {
        const zoomedCamera = zoomAround(readCamera(camera), { x: event.focalX, y: event.focalY }, startScale.value * event.scale);
        const next = clampCamera(zoomedCamera, canvas, view);
        camera.scale.value = next.scale;
        camera.tx.value = next.tx;
        camera.ty.value = next.ty;
      })
      .onEnd(() => {
        if (camera.scale.value <= MIN_ZOOM + ZOOM_EPSILON) resetCamera(camera);
      });

    const pan = Gesture.Pan()
      .enabled(enabled && (zoomed || overflows))
      .averageTouches(true)
      .onStart(() => {
        stopCamera(camera);
        startTx.value = camera.tx.value;
        startTy.value = camera.ty.value;
      })
      .onUpdate((event) => {
        const next = clampCamera(
          { scale: camera.scale.value, tx: startTx.value + event.translationX, ty: startTy.value + event.translationY },
          canvas,
          view
        );
        camera.tx.value = next.tx;
        camera.ty.value = next.ty;
      });

    // 핀치를 못 쓰는 환경(브라우저가 두 손가락을 페이지 확대로 가져가는 경우)에서도 확대할 수 있게 토글로 둔다.
    const doubleTap = Gesture.Tap()
      .enabled(enabled)
      .numberOfTaps(2)
      .maxDuration(300)
      .onEnd((event) => {
        if (camera.scale.value > MIN_ZOOM + ZOOM_EPSILON) {
          resetCamera(camera);
          return;
        }
        const next = clampCamera(zoomAround(readCamera(camera), { x: event.x, y: event.y }, MAX_ZOOM), canvas, view);
        camera.scale.value = withTiming(next.scale, RESET_TIMING);
        camera.tx.value = withTiming(next.tx, RESET_TIMING);
        camera.ty.value = withTiming(next.ty, RESET_TIMING);
      });

    return Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [locked, width, zoomed, viewportWidth, viewportHeight, camera, startScale, startTx, startTy]);

  return { camera, gesture, zoomed };
}
