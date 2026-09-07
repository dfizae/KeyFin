import type { SceneSize } from "@/features/room/model";

// 0단계 스파이크용 에셋. 바닥은 빈 방 이미지를 임시로 쓴다(CTA 문구가 그려져 있음 — 캐릭터·문구 없는 바닥 원본이 필요하다, TBD).
// 스프라이트는 앱 에셋이므로 assets/sprites 에만 둔다. 시트를 넣기 전에 Git LFS 를 켠다.
export const ROOM_FLOOR = require("@/assets/images/character-room-empty.png");
export const CHARACTER_IDLE = require("@/assets/sprites/char1-idle.png");

/** char1-idle.png 는 496×756 이라 씬 단위로 72×110 정도가 Pencil 목업의 캐릭터 크기다. */
export const CHARACTER_SIZE: SceneSize = { width: 72, height: 110 };
