import { api, isMocked } from "@/api/client";
import { withMockLatency } from "@/api/mocks/latency";
import { attendanceMock, roomMock } from "@/api/mocks/room";
import { toAttendance, toRoom, type Attendance, type AttendanceDto, type Room, type RoomDto } from "@/features/room/model";

/** GET /room — 방 홈 화면 데이터: 테마·착장·반응·코인·보드 요약·출석 상태 (docs/api-contract.md GAME, FR-GAM-01) */
export async function getRoom(signal?: AbortSignal): Promise<Room> {
  if (isMocked("room")) return toRoom(await withMockLatency(roomMock, signal));
  const { data } = await api.get<RoomDto>("/room", { signal });
  return toRoom(data);
}

/** POST /attendance — 당일 출석 처리. 이미 출석했으면 granted=0 이고 중복 지급은 서버 유니크 제약이 막는다 (FR-GAM-03) */
export async function checkAttendance(): Promise<Attendance> {
  if (isMocked("room")) return toAttendance(await withMockLatency(attendanceMock));
  const { data } = await api.post<AttendanceDto>("/attendance");
  return toAttendance(data);
}
