import { Paintbrush } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { selectIsEditing, useRoomStore } from "@/features/room/store";

export const EDIT_LABEL = "방 꾸미기";
export const EDIT_HINT = "가구를 끌어서 옮기세요";

/**
 * 방 씬 위에 얹는 편집 컨트롤. Pencil 시안 없음(미대조) — DESIGN.md 기준으로 만든다.
 * 평소: 우상단 "방 꾸미기" 버튼. 편집 중: 상단 안내 문구 + 하단 취소·완료.
 * 실제 저장(PUT /room/layout)은 3단계에서 commitEdit 뒤에 붙인다.
 */
function RoomEditorOverlay() {
  const isEditing = useRoomStore(selectIsEditing);
  const startEdit = useRoomStore((s) => s.startEdit);
  const cancelEdit = useRoomStore((s) => s.cancelEdit);
  const commitEdit = useRoomStore((s) => s.commitEdit);

  if (!isEditing) {
    return (
      <View className="absolute right-3 top-3" pointerEvents="box-none">
        <Button variant="secondary" size="sm" onPress={startEdit} accessibilityLabel={EDIT_LABEL}>
          <Icon as={Paintbrush} size={16} className="text-secondary-foreground" />
          <Text>꾸미기</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="absolute inset-0 justify-between p-3" pointerEvents="box-none">
      <View className="items-center" pointerEvents="none">
        <View className="rounded-full bg-inverse/80 px-3 py-1">
          <Text className="text-caption text-inverse-foreground">{EDIT_HINT}</Text>
        </View>
      </View>
      <View className="flex-row justify-end gap-2" pointerEvents="box-none">
        <Button variant="secondary" size="sm" onPress={cancelEdit} accessibilityLabel="편집 취소">
          <Text>취소</Text>
        </Button>
        <Button size="sm" onPress={commitEdit} accessibilityLabel="편집 완료">
          <Text>완료</Text>
        </Button>
      </View>
    </View>
  );
}

export { RoomEditorOverlay };
