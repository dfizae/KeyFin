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
 * 팝오버·코치·스크롤이 겹쳐 드래그하기 불편하다(사용자 결정 2026-09-15).
 * 2026-09-18 부터 자기 자리를 정하지 않는다: 방이 화면보다 넓어져(cover 맞춤) 방 오른쪽 끝이 화면 밖으로 나가기 때문에,
 * 부르는 쪽(홈의 사이드 버튼 줄)이 화면 기준으로 놓는다.
 */
function RoomEditorOverlay() {
  const router = useRouter();

  return (
    <View pointerEvents="box-none">
      <Button variant="secondary" size="sm" onPress={() => router.push(ROOM_EDIT_ROUTE)} accessibilityLabel={EDIT_LABEL}>
        <Icon as={Paintbrush} size={16} className="text-secondary-foreground" />
        <Text>꾸미기</Text>
      </Button>
    </View>
  );
}

export { RoomEditorOverlay };
