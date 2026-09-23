import { isWallItemId } from "@/features/room/catalog";
import { getSpriteRect, type SceneRect } from "@/features/room/model";
import { facingOf, placementView, type Placement } from "@/features/room/scene";

/** Blender integration_reference.json의 잘린 가구 이미지 기준 좌표. 색상과 무관하다.
 * FRONT_RIGHT = left_wall 렌더, FRONT_LEFT = right_wall 렌더이며 미러링하지 않는다.
 * output/penalties_room_matched의 다른 효과는 앱에 포함하지 않는다.
 */
const PENALTIES = {
  dining_table: {
    envelopeId: 1,
    rect: { x: -14.125688, y: -12.54547, width: 132.051376, height: 116.879316 },
    sprites: {
      FRONT_RIGHT: require("@/assets/sprites/penalties/penalty_food_dishes__left_wall.png") as number,
      FRONT_LEFT: require("@/assets/sprites/penalties/penalty_food_dishes__right_wall.png") as number,
    },
  },
  coffee_table: {
    envelopeId: 4,
    rect: { x: -15.868644, y: -12.862088, width: 106.637288, height: 81.301099 },
    sprites: {
      FRONT_RIGHT: require("@/assets/sprites/penalties/penalty_leisure_gaming__left_wall.png") as number,
      FRONT_LEFT: require("@/assets/sprites/penalties/penalty_leisure_gaming__right_wall.png") as number,
    },
  },
} as const;

export const PENALTY_SPRITES = Object.values(PENALTIES).flatMap((effect) => Object.values(effect.sprites));
export type PenaltyGeometry = { sprite: number; rect: SceneRect };

/** 편집 사본의 종류·방향·위치를 사용하므로 교체와 드래그에도 붙어 있고, 가구로 저장되지 않는다. */
export function penaltyGeometry(placement: Placement, overEnvelopeIds: readonly number[]): PenaltyGeometry | null {
  if (isWallItemId(placement.itemId) || (placement.surface ?? "FLOOR") !== "FLOOR") return null;
  const kind = placement.itemId.replace(/_(original|black|pink|sunset)$/, "");
  if (kind !== "dining_table" && kind !== "coffee_table") return null;
  const effect = PENALTIES[kind];
  if (!overEnvelopeIds.includes(effect.envelopeId)) return null;
  const view = placementView(placement);
  const furniture = getSpriteRect(placement.anchor, view.size, view.anchor);
  return { sprite: effect.sprites[facingOf(placement)], rect: {
    ...effect.rect, x: furniture.x + effect.rect.x, y: furniture.y + effect.rect.y,
  } };
}

export type VisiblePenalty = { envelopeId: number; itemId: Placement["itemId"] };

/** 지금 방에 실제로 그려지는 부스러기(초과 봉투에 걸린 식탁·커피 테이블). 코치 말풍선이 어느 가구가 어질러졌는지 말할 때 쓴다 */
export function visiblePenalties(placements: readonly Placement[], overEnvelopeIds: readonly number[]): VisiblePenalty[] {
  return placements.flatMap((placement) => {
    if (penaltyGeometry(placement, overEnvelopeIds) === null) return [];
    const kind = placement.itemId.replace(/_(original|black|pink|sunset)$/, "") as keyof typeof PENALTIES;
    return [{ envelopeId: PENALTIES[kind].envelopeId, itemId: placement.itemId }];
  });
}
