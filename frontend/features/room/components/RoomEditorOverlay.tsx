import { useRouter } from "expo-router";
import { Paintbrush } from "lucide-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

export const EDIT_LABEL = "방 꾸미기";
export const ROOM_EDIT_ROUTE = "/room/edit";

/**
 * 홈의 방 씬 위에 얹는 편집 진입 버튼(우상단 "꾸미기"). Pencil home/p0 (EWfx2) 에는 없는 요소라 미대조.
 * 편집 자체는 같은 자리에서 하지 않고 방 꾸미기 화면(RoomEditScreen, /room/edit)으로 간다 — 홈은 씬이 작고
 * 팝오버·코치·스크롤이 겹쳐 드래그하기 불편하다(사용자 결정 2026-09-15). 홈의 panels 레이어(카메라 밖)에 둔다.
 */
function RoomEditorOverlay() {
  const router = useRouter();

  return (
    <View className="absolute right-3 top-3" pointerEvents="box-none">
      <Button variant="secondary" size="sm" onPress={() => router.push(ROOM_EDIT_ROUTE)} accessibilityLabel={EDIT_LABEL}>
        <Icon as={Paintbrush} size={16} className="text-secondary-foreground" />
        <Text>꾸미기</Text>
      </Button>
    </View>
  );
}

export { RoomEditorOverlay };
