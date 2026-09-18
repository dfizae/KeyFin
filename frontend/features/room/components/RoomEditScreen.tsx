import { useRouter } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { useRoom, useSavePlacements } from "@/features/room/api/queries";
import { RoomView } from "@/features/room/components/RoomView";
import { changedPlacements } from "@/features/room/furniture";
import { useRoomStore } from "@/features/room/store";
import { useRoomLayoutSync } from "@/features/room/useRoomLayout";

export const EDIT_TITLE = "방 꾸미기";
export const EDIT_HINT = "가구와 벽 오브젝트를 끌어서 옮기세요";
export const EDIT_ROOM_LABEL = "편집 중인 방";
export const EDIT_SAVE_ERROR = "자리를 저장하지 못했어요. 연결 상태를 확인한 뒤 다시 눌러 주세요.";
const HOME_ROUTE = "/";

/**
 * 방 꾸미기 화면 (홈 '꾸미기' → /room/edit). 씬을 화면 폭 가득 키워 가구·벽 오브젝트를 드래그로 옮긴다(스냅·겹침 판정은 RoomScene).
 * 들어오면 편집 사본(draft)을 만들고, 완료는 옮긴 가구만 서버에 저장한 뒤 확정, 취소(뒤로가기 포함)는 버린 뒤 홈으로 돌아간다.
 * 저장은 가구 한 개씩 PATCH /furnitures/{userFurnitureId} 다(일괄 엔드포인트 없음). 실패하면 사본을 그대로 두고 다시 누를 수 있게 한다.
 * 카메라는 드래그와 겹치지 않게 1배로 잠근다. Pencil PAGE-10 방 꾸미기 (HTF8Q, 2026-09-15).
 */
function RoomEditScreen() {
  const router = useRouter();
  const room = useRoom();
  useRoomLayoutSync();
  const startEdit = useRoomStore((s) => s.startEdit);
  const cancelEdit = useRoomStore((s) => s.cancelEdit);
  const commitEdit = useRoomStore((s) => s.commitEdit);
  const save = useSavePlacements();

  // 서버 배치를 받은 뒤에 사본을 뜬다 — 먼저 뜨면 기본 배치를 편집하게 되어 저장할 대상이 없다.
  // 화면을 어떤 경로로 떠나든(뒤로 제스처·탭 이동) 남은 사본은 버린다. 완료 뒤에는 사본이 이미 없어 아무 일도 없다.
  React.useEffect(() => {
    if (room.isPending) return;
    startEdit();
    return () => cancelEdit();
  }, [room.isPending, startEdit, cancelEdit]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(HOME_ROUTE);
  };
  const cancel = () => {
    cancelEdit();
    leave();
  };
  const done = () => {
    if (save.isPending) return;
    // 드래그는 매 프레임 스토어를 고치므로 누를 때의 값을 직접 읽는다(구독한 값은 한 렌더 뒤처질 수 있다).
    const { layout, draft } = useRoomStore.getState();
    const saves = changedPlacements(layout, draft ?? layout);
    if (saves.length === 0) {
      commitEdit();
      leave();
      return;
    }
    save.mutate(saves, {
      onSuccess: () => {
        commitEdit();
        leave();
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={EDIT_TITLE} onBack={cancel} />
      <View className="flex-1 justify-center gap-4">
        <RoomView accessibilityLabel={EDIT_ROOM_LABEL} locked />
        <Text className="text-center text-body-sm text-card-foreground">{EDIT_HINT}</Text>
      </View>
      {save.isError ? (
        <View className="flex-row items-center gap-1.5 px-6" accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size={16} className="text-destructive" />
          <Text className="shrink text-caption text-destructive">{EDIT_SAVE_ERROR}</Text>
        </View>
      ) : null}
      <View className="flex-row gap-2 px-6 pb-8 pt-2">
        <Button
          variant="outline"
          className="h-button-lg flex-1 rounded-lg"
          onPress={cancel}
          disabled={save.isPending}
          accessibilityState={{ disabled: save.isPending }}
          accessibilityLabel="편집 취소"
        >
          <Text>취소</Text>
        </Button>
        <Button
          className="h-button-lg flex-1 rounded-lg"
          onPress={done}
          disabled={save.isPending}
          accessibilityState={{ disabled: save.isPending }}
          accessibilityLabel="편집 완료"
        >
          <Text>{save.isPending ? "저장하는 중" : "완료"}</Text>
        </Button>
      </View>
    </View>
  );
}

export { RoomEditScreen };
