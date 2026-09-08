import type { AttendanceDto, RoomDto } from "@/features/room/model";

/**
 * GET /room 응답 예시 (docs/api-contract.md GAME — 명세에 예시가 없어 필드 표로 구성).
 * Pencil home/p0 (EWfx2) 의 값: 코인 1,250 · 9월 예산 36% 남음 · 오늘 출석 전. equipped 는 가입 시 지급되는 기본 3종(FR-USR-01).
 */
export const roomMock: RoomDto = {
  theme: "AUTUMN_2026",
  avatar: {
    equipped: [
      { slotType: "HAIR", itemId: 1, assetKey: "hair_default" },
      { slotType: "OUTFIT", itemId: 2, assetKey: "outfit_default" },
      { slotType: "FACE", itemId: 3, assetKey: "face_default" },
    ],
    reaction: null,
  },
  coin: { balance: 1250 },
  board: { month: "202609", totalRemainingRate: 36 },
  attendance: { checkedToday: false },
};

/** POST /attendance 응답 예시 (계약 사본 그대로): 출석 +10 → 잔액 1,260 */
export const attendanceMock: AttendanceDto = { granted: 10, balance: 1260 };
