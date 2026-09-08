import { View } from "react-native";

import { RoomView } from "@/features/room/components/RoomView";

// Pencil home/p0 (EWfx2) CharacterRoom 327×404. 가입 시 기본 착장이 지급되므로 빈 방 상태는 없다 (결정 2026-09-08).
export const ROOM_LABEL = "캐릭터가 방에 있어요";

function CharacterRoom() {
  return (
    <View className="px-6">
      <RoomView accessibilityLabel={ROOM_LABEL} />
    </View>
  );
}

export { CharacterRoom };
