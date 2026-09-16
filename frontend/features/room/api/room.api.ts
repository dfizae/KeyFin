import { api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { attendanceMock, roomMock } from "@/api/mocks/room";
import { toAttendance, toRoom, type Attendance, type AttendanceDto, type Room, type RoomDto } from "@/features/room/model";

/** GET /room — 방 홈 화면 데이터: 착장·반응·설치 가구·코인·출석 상태 (docs/api-contract.md GAME, FR-GAM-01) */
export async function getRoom(signal?: AbortSignal): Promise<Room> {
  if (isMocked("room")) return toRoom(await withMockLatency(roomMock, signal));
  const { data } = await api.get<RoomDto>("/room", { signal });
  return toRoom(data);
}

/**
 * POST /fin-coins/attendance — 당일 첫 출석에 10코인 (FR-GAM-03, 2026-09-16 Swagger 대조로 경로 정정).
 * 날짜는 서버가 사용자 잠금을 잡고 KST 로 정한다. 당일 재요청도 200 이고 granted=0 · balance 는 최신 잔액이다.
 */
export async function checkAttendance(): Promise<Attendance> {
  if (isMocked("room")) return toAttendance(await withMockLatency(attendanceMock));
  const { data } = await api.post<AttendanceDto>("/fin-coins/attendance");
  return toAttendance(data);
}
