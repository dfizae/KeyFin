import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";

import { RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { RoomSceneLoader } from "@/features/room/components/RoomSceneLoader";

export const ROOM_VIEW_TEST_ID = "room-view";

type RoomViewProps = {
  /** 씬 영역의 접근성 라벨(예: "캐릭터가 방에 있어요") */
  accessibilityLabel: string;
  /** 씬 위에 얹는 벽 오브젝트(보드·캘린더). 캔버스 폭을 받아 씬 좌표를 환산한다 */
  children?: (width: number) => React.ReactNode;
};

/** 방 씬(캔버스)과 편집 컨트롤, 벽 오브젝트 오버레이를 겹쳐 놓은 홈용 뷰 */
function RoomView({ accessibilityLabel, children }: RoomViewProps) {
  const [width, setWidth] = React.useState(0);
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  return (
    <View className="relative" onLayout={handleLayout} testID={ROOM_VIEW_TEST_ID}>
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <RoomSceneLoader />
      </View>
      <RoomEditorOverlay />
      {children && width > 0 ? (
        <View className="absolute inset-0" pointerEvents="box-none">
          {children(width)}
        </View>
      ) : null}
    </View>
  );
}

export { RoomView };
export type { RoomViewProps };
