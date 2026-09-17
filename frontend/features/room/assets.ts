import type { SpriteFrames } from "@/components/ui/sprite";

// 방 씬 에셋. 스프라이트는 앱 에셋이므로 assets/sprites 에만 둔다(Git LFS 대상). 가구는 features/room/catalog.ts 에 있다.
// 바닥은 Pencil AI 생성 원본(design/images/ai/floor-default.jpg)을 x 416 부터 622×768 로 잘라낸 이미지다(씬 비율 327:404).
// 2026-09-09 판은 창문(window.jpg)을 합성했지만, 벽걸이 아이템을 격자에 채우려고 2026-09-15 창문 없이 다시 잘랐다(사용자 결정).
// 벽·바닥 경계선(scene.ts FLOOR_POLYGON·SURFACES)은 같은 크롭이라 그대로다.
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

/**
 * 프레임 전환용 포즈 묶음(components/ui/sprite.tsx). 지금은 포즈당 base 1장이라 정지 이미지와 같다.
 * blink(눈 감음)·motion(손 위치 다른 장) PNG 가 오면 여기에만 꽂으면 로그인·회원가입·입주 화면이 움직인다 (2026-09-16).
 * 프레임은 base 와 같은 크기·같은 발끝 위치여야 한다.
 */
export const CHARACTER_FRAMES = {
  wave: { base: CHARACTER_WAVE },
  phone: { base: CHARACTER_PHONE },
  scan: { base: CHARACTER_SCAN },
  celebrate: { base: CHARACTER_CELEBRATE },
} satisfies Record<string, SpriteFrames>;
