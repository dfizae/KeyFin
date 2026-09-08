// 방 씬 에셋. 스프라이트는 앱 에셋이므로 assets/sprites 에만 둔다(Git LFS 대상). 가구는 features/room/catalog.ts 에 있다.
// 바닥은 Pencil AI 생성 원본(design/images/ai/floor-default.jpg)을 씬 비율(327:404)로 잘라 창문(window.jpg)을 합성한 622×768 이미지다.
export const ROOM_FLOOR = require("@/assets/sprites/floors/floor-default.png");
export const CHARACTER_IDLE = require("@/assets/sprites/char1-idle.png");
