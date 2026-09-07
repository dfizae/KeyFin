import {
  clamp,
  getCanvasSize,
  getSceneScale,
  getSpriteRect,
  SCENE_ASPECT_RATIO,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  sceneRectToCanvas,
} from "@/features/room/model";

describe("room scene 좌표계", () => {
  it("씬 단위는 Pencil CharacterRoom 327×404 이다", () => {
    expect(SCENE_WIDTH).toBe(327);
    expect(SCENE_HEIGHT).toBe(404);
    expect(SCENE_ASPECT_RATIO).toBeCloseTo(327 / 404);
  });

  it("캔버스 폭에 따라 scale 과 높이를 구한다", () => {
    expect(getSceneScale(327)).toBe(1);
    expect(getSceneScale(654)).toBe(2);
    expect(getCanvasSize(654)).toEqual({ width: 654, height: 808 });
  });

  it("발끝 기준점으로 스프라이트 사각형을 구한다", () => {
    const rect = getSpriteRect({ x: 160, y: 330 }, { width: 72, height: 106 });
    expect(rect.x).toBeCloseTo(124);
    expect(rect.y).toBeCloseTo(330 - 106 * 0.95);
    expect(rect.width).toBe(72);
    expect(rect.height).toBe(106);
  });

  it("기준점 비율을 바꾸면 좌상단 기준으로도 둘 수 있다", () => {
    const rect = getSpriteRect({ x: 10, y: 20 }, { width: 30, height: 40 }, { x: 0, y: 0 });
    expect(rect).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it("씬 사각형을 scale 로 캔버스 픽셀로 바꾼다", () => {
    expect(sceneRectToCanvas({ x: 10, y: 20, width: 30, height: 40 }, 2)).toEqual({ x: 20, y: 40, width: 60, height: 80 });
  });

  it("clamp 는 범위를 벗어난 값을 경계로 자른다", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});
