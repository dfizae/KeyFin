import * as React from "react";
import { View } from "react-native";

import { RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { RoomSceneLoader } from "@/features/room/components/RoomSceneLoader";

type RoomViewProps = {
  /** 씬 영역의 접근성 라벨(예: "키핀 캐릭터가 방에 있어요") */
  accessibilityLabel: string;
};

/** 방 씬(캔버스)과 편집 컨트롤을 겹쳐 놓은 홈용 뷰 */
function RoomView({ accessibilityLabel }: RoomViewProps) {
  return (
    <View className="relative">
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <RoomSceneLoader />
      </View>
      <RoomEditorOverlay />
    </View>
  );
}

export { RoomView };
export type { RoomViewProps };
