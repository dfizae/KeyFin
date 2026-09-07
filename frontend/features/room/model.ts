/**
 * 방 씬의 좌표계. 씬 단위는 Pencil CharacterRoom(Plvf1) 327×404 pt 를 그대로 쓴다.
 * 기기 폭에 맞춰 scale 만 곱하므로 배치·저장 좌표는 항상 씬 단위다(픽셀 아님).
 * Reanimated 워크릿 안에서도 부르므로 순수 함수마다 "worklet" 지시자를 둔다.
 */
export const SCENE_WIDTH = 327;
export const SCENE_HEIGHT = 404;
export const SCENE_ASPECT_RATIO = SCENE_WIDTH / SCENE_HEIGHT;

export type ScenePoint = { x: number; y: number };
export type SceneSize = { width: number; height: number };
export type SceneRect = ScenePoint & SceneSize;

/** 스프라이트의 기준점 비율. 기본은 발끝(가로 중앙, 세로 95%)이라 y정렬과 배치 좌표의 기준이 된다. */
export type AnchorRatio = { x: number; y: number };
export const FOOT_ANCHOR: AnchorRatio = { x: 0.5, y: 0.95 };

export function getSceneScale(canvasWidth: number): number {
  "worklet";
  return canvasWidth / SCENE_WIDTH;
}

export function getCanvasSize(canvasWidth: number): SceneSize {
  "worklet";
  return { width: canvasWidth, height: canvasWidth / SCENE_ASPECT_RATIO };
}

export function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

/** 기준점(씬 단위)과 크기로 스프라이트의 좌상단 사각형을 구한다. */
export function getSpriteRect(anchor: ScenePoint, size: SceneSize, anchorRatio: AnchorRatio = FOOT_ANCHOR): SceneRect {
  "worklet";
  return {
    x: anchor.x - size.width * anchorRatio.x,
    y: anchor.y - size.height * anchorRatio.y,
    width: size.width,
    height: size.height,
  };
}

/** 씬 단위 사각형을 캔버스 픽셀 사각형으로 바꾼다. */
export function sceneRectToCanvas(rect: SceneRect, scale: number): SceneRect {
  "worklet";
  return { x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
}
