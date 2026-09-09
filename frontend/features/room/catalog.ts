import type { AnchorRatio, SceneSize } from "@/features/room/model";

/**
 * 가구 정의. 백엔드 `GET /room/catalog` 가 생기면 그 응답으로 대체하고 여기는 스프라이트 require 만 남긴다. (TBD)
 * - sprite: assets/sprites/furniture 의 투명 PNG(scripts/assets/remove-white-bg.ps1 산출물, 그림자 포함 bbox 크롭)
 * - size: 씬 단위 크기. PNG 비율을 유지하고 폭 또는 높이 하나만 정했다.
 * - anchor: 바닥에 닿는 기준점 비율. 그림자가 아래·오른쪽으로 퍼져 있어 발끝은 0.9 부근이다.
 */
export type FurnitureId = "sofa" | "coffee-table" | "desk" | "fridge" | "plant";

export type FurnitureItem = {
  id: FurnitureId;
  name: string;
  sprite: number;
  size: SceneSize;
  anchor: AnchorRatio;
  /** 캐릭터가 앞뒤로 걸치는 가구의 깊이 보정. 기본 0 */
  layer?: number;
};

const ratio = (width: number, pngWidth: number, pngHeight: number): SceneSize => ({
  width,
  height: Math.round((width * pngHeight) / pngWidth),
});

export const FURNITURE: Record<FurnitureId, FurnitureItem> = {
  sofa: {
    id: "sofa",
    name: "소파",
    sprite: require("@/assets/sprites/furniture/sofa.png"),
    // 그림자가 오른쪽 아래로 퍼져 bbox 가 넓다. 소파 본체는 왼쪽 65% 안에 있다.
    size: ratio(165, 1000, 622),
    anchor: { x: 0.4, y: 0.88 },
  },
  "coffee-table": {
    id: "coffee-table",
    name: "테이블",
    sprite: require("@/assets/sprites/furniture/coffee-table.png"),
    size: ratio(90, 507, 471),
    anchor: { x: 0.5, y: 0.9 },
  },
  desk: {
    id: "desk",
    name: "책상",
    sprite: require("@/assets/sprites/furniture/desk.png"),
    size: ratio(105, 458, 570),
    anchor: { x: 0.5, y: 0.9 },
  },
  fridge: {
    id: "fridge",
    name: "냉장고",
    sprite: require("@/assets/sprites/furniture/fridge.png"),
    size: ratio(62, 491, 599),
    anchor: { x: 0.5, y: 0.9 },
  },
  plant: {
    id: "plant",
    name: "화분",
    sprite: require("@/assets/sprites/furniture/plant.png"),
    size: ratio(45, 279, 574),
    anchor: { x: 0.5, y: 0.95 },
  },
};
