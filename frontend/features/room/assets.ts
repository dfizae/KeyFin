// 방 씬 에셋. 스프라이트는 앱 에셋이므로 assets/sprites 에만 둔다(Git LFS 대상). 가구는 features/room/catalog.ts 에 있다.
// 바닥은 Pencil AI 생성 원본(design/images/ai/floor-default.jpg)을 씬 비율(327:404)로 잘라 창문(window.jpg)을 합성한 622×768 이미지다.
export const ROOM_FLOOR = require("@/assets/sprites/floors/floor-default.png");
export const CHARACTER_IDLE = require("@/assets/sprites/char1-idle.png");
/** 입주 연출(PAGE-08)에서만 쓰는 환호 포즈 */
export const CHARACTER_CELEBRATE = require("@/assets/sprites/char1-celebrate.png");
/** 온보딩 코치 — 손 흔드는 포즈(로그인·회원가입) */
export const CHARACTER_WAVE = require("@/assets/sprites/char1-wave.png");
/** 온보딩 코치 — 휴대폰 보는 포즈(약관·소비 분석 중) */
export const CHARACTER_PHONE = require("@/assets/sprites/char1-phone.png");
/** 온보딩 코치 — 살펴보는 포즈(금융망 이메일) */
export const CHARACTER_SCAN = require("@/assets/sprites/char1-scan.png");
