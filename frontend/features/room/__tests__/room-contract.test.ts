import { attendanceMock, roomMock } from "@/api/mocks/room";
import { toAttendance, toRoom } from "@/features/room/model";
import { ContractMismatchError } from "@/lib/contract";

describe("toAttendance", () => {
  it("지급 코인과 잔액을 그대로 옮기고 0 지급도 허용한다", () => {
    expect(toAttendance(attendanceMock)).toEqual({ granted: 10, balance: 1260 });
    expect(toAttendance({ granted: 0, balance: 1250 })).toEqual({ granted: 0, balance: 1250 });
  });

  it("음수·소수는 계약 불일치다", () => {
    expect(() => toAttendance({ granted: -10, balance: 1250 })).toThrow(ContractMismatchError);
    expect(() => toAttendance({ granted: 10, balance: 12.5 })).toThrow(ContractMismatchError);
  });
});

describe("toRoom", () => {
  it("코인·보드 요약·출석·기본 착장을 화면 모델로 옮기고 선택 필드는 기본값을 채운다", () => {
    const room = toRoom(roomMock);
    expect(room.theme).toBe("AUTUMN_2026");
    expect(room.coinBalance).toBe(1250);
    expect(room.board).toEqual({ month: "202609", totalRemainingRate: 36 });
    expect(room.checkedInToday).toBe(false);
    expect(room.equipped.map((item) => item.slotType)).toEqual(["HAIR", "OUTFIT", "FACE"]);
    expect(room.reaction).toBeNull();
    expect(room.stickers).toBeNull();
    expect(room.overEnvelopeIds).toEqual([]);
  });

  it("모르는 슬롯 유형은 UNKNOWN 으로 흡수하고 P1 필드는 있으면 그대로 넘긴다", () => {
    const room = toRoom({
      ...roomMock,
      avatar: { equipped: [{ slotType: "PET", itemId: 9, assetKey: "pet_cat" }], reaction: { type: "SHOPPING", until: "2026-09-08T15:00:00" } },
      stickers: { count: 4, total: 7, removableToday: true },
      overEnvelopes: [5],
    });
    expect(room.equipped[0].slotType).toBe("UNKNOWN");
    expect(room.reaction).toEqual({ type: "SHOPPING", until: "2026-09-08T15:00:00" });
    expect(room.stickers).toEqual({ count: 4, total: 7, removableToday: true });
    expect(room.overEnvelopeIds).toEqual([5]);
  });

  it("코인이 음수·소수이거나 보드 월 형식·잔여율이 틀리면 계약 불일치다", () => {
    expect(() => toRoom({ ...roomMock, coin: { balance: -1 } })).toThrow(ContractMismatchError);
    expect(() => toRoom({ ...roomMock, coin: { balance: 1.5 } })).toThrow(ContractMismatchError);
    expect(() => toRoom({ ...roomMock, board: { month: "2026-09", totalRemainingRate: 36 } })).toThrow(ContractMismatchError);
    expect(() => toRoom({ ...roomMock, board: { month: "202609", totalRemainingRate: 36.5 } })).toThrow(ContractMismatchError);
  });
});
