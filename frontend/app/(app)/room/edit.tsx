import { View } from "react-native";

import { RoomEditScreen } from "@/features/room/components/RoomEditScreen";

// 방 꾸미기. 홈 방 씬의 '꾸미기' 버튼에서 들어와 가구·벽 오브젝트를 옮기고 완료하면 홈으로 돌아간다.
export default function RoomEditRoute() {
  return (
    <View className="flex-1 bg-background">
      <RoomEditScreen />
    </View>
  );
}
