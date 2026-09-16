import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { RoomView } from "@/features/room/components/RoomView";
import { useRoomStore } from "@/features/room/store";

export const EDIT_TITLE = "방 꾸미기";
export const EDIT_HINT = "가구와 벽 오브젝트를 끌어서 옮기세요";
export const EDIT_ROOM_LABEL = "편집 중인 방";
const HOME_ROUTE = "/";

/**
 * 방 꾸미기 화면 (홈 '꾸미기' → /room/edit). 씬을 화면 폭 가득 키워 가구·벽 오브젝트를 드래그로 옮긴다(스냅·겹침 판정은 RoomScene).
 * 들어오면 편집 사본(draft)을 만들고, 완료는 확정·취소(뒤로가기 포함)는 버린 뒤 홈으로 돌아간다.
 * 실제 저장(PUT /room/layout)은 3단계에서 commitEdit 뒤에 붙인다. 카메라는 드래그와 겹치지 않게 1배로 잠근다.
 * Pencil PAGE-10 방 꾸미기 (HTF8Q, 2026-09-15).
 */
function RoomEditScreen() {
  const router = useRouter();
  const startEdit = useRoomStore((s) => s.startEdit);
  const cancelEdit = useRoomStore((s) => s.cancelEdit);
  const commitEdit = useRoomStore((s) => s.commitEdit);

  // 화면을 어떤 경로로 떠나든(뒤로 제스처·탭 이동) 남은 사본은 버린다. 완료 뒤에는 사본이 이미 없어 아무 일도 없다.
  React.useEffect(() => {
    startEdit();
    return () => cancelEdit();
  }, [startEdit, cancelEdit]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(HOME_ROUTE);
  };
  const cancel = () => {
    cancelEdit();
    leave();
  };
  const done = () => {
    commitEdit();
    leave();
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={EDIT_TITLE} onBack={cancel} />
      <View className="flex-1 justify-center gap-4">
        <RoomView accessibilityLabel={EDIT_ROOM_LABEL} locked />
        <Text className="text-center text-body-sm text-card-foreground">{EDIT_HINT}</Text>
      </View>
      <View className="flex-row gap-2 px-6 pb-8 pt-2">
        <Button variant="outline" className="h-button-lg flex-1 rounded-lg" onPress={cancel} accessibilityLabel="편집 취소">
          <Text>취소</Text>
        </Button>
        <Button className="h-button-lg flex-1 rounded-lg" onPress={done} accessibilityLabel="편집 완료">
          <Text>완료</Text>
        </Button>
      </View>
    </View>
  );
}

export { RoomEditScreen };
