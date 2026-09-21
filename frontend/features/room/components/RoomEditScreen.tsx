import { useRouter } from "expo-router";
import { Archive, CircleAlert, FlipHorizontal2, Sofa } from "lucide-react-native";
import * as React from "react";
import { FlatList, Image, Pressable, View, type LayoutChangeEvent } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useFurnitures, useRoom, useSavePlacements } from "@/features/room/api/queries";
import { roomItemName, roomItemThumbnail, isWallItemId } from "@/features/room/catalog";
import { RoomView } from "@/features/room/components/RoomView";
import {
  changedPlacements,
  storeAwayBlock,
  storedFurnitures,
  type StoreAwayBlock,
  type StoredFurniture,
  type UserFurniture,
} from "@/features/room/furniture";
import { containSceneWidth } from "@/features/room/model";
import { placeNewItem, type Placement } from "@/features/room/scene";
import { selectPlacements, useRoomStore } from "@/features/room/store";
import { useRoomLayoutSync } from "@/features/room/useRoomLayout";

export const EDIT_TITLE = "방 꾸미기";
export const EDIT_HINT = "가구를 끌어서 옮기세요. 누르면 방향을 바꾸거나 넣어 둘 수 있어요";
export const EDIT_ROOM_LABEL = "편집 중인 방";
export const EDIT_SAVE_ERROR = "자리를 저장하지 못했어요. 연결 상태를 확인한 뒤 다시 눌러 주세요.";
export const STORAGE_TITLE = "보관함";
const NO_ROOM_NOTICE = "놓을 빈자리가 없어요. 다른 가구를 옮기거나 넣어 둔 뒤 다시 눌러 주세요.";
const NO_TURN_NOTICE = "돌릴 자리가 없어요. 주변을 비운 뒤 다시 눌러 주세요.";
const STORE_AWAY_BLOCK_TEXT: Record<StoreAwayBlock, string> = {
  WALL_OBJECT: "예산 보드·출금 캘린더는 옮기기만 할 수 있어요.",
  DEFAULT_FURNITURE: "기본 가구는 넣어 둘 수 없어요.",
};
const HOME_ROUTE = "/";
/** 보관함 타일 그림. 64pt 타일 안의 4px 스케일 밖 크기라 style 로 준다(상점 타일과 같은 방식) */
const TRAY_SPRITE_STYLE = { width: 48, height: 48 } as const;

/**
 * 방 꾸미기 화면 (홈 '꾸미기' → /room/edit). 씬을 화면 폭 가득 키워 가구·벽 오브젝트를 드래그로 옮긴다(스냅·겹침 판정은 RoomScene).
 * 들어오면 편집 사본(draft)을 만들고, 완료는 바뀐 가구만 서버에 저장한 뒤 확정, 취소(뒤로가기 포함)는 버린 뒤 홈으로 돌아간다.
 * 2026-09-21: 산 가구를 꺼내 놓는 보관함과, 고른 가구의 '방향 바꾸기'·'넣어 두기'를 더했다(사용자 결정). 보관함은 GET /furnitures 에서
 * 사본에 없는 보유 가구이고, 넣어 둔 가구는 저장할 때 설치 해제로 나간다.
 * 저장은 가구 한 개씩 PATCH /furnitures/{userFurnitureId} 다(일괄 엔드포인트 없음). 실패하면 사본을 그대로 두고 다시 누를 수 있게 한다.
 * 카메라는 드래그와 겹치지 않게 1배로 잠근다. Pencil PAGE-10 방 꾸미기 (HTF8Q, 2026-09-15) — 보관함·선택 동작 줄은 Pencil 미대조.
 */
function RoomEditScreen() {
  const router = useRouter();
  const room = useRoom();
  const furnitures = useFurnitures();
  useRoomLayoutSync();
  const placements = useRoomStore(selectPlacements);
  const selectedId = useRoomStore((s) => s.selectedId);
  const startEdit = useRoomStore((s) => s.startEdit);
  const cancelEdit = useRoomStore((s) => s.cancelEdit);
  const commitEdit = useRoomStore((s) => s.commitEdit);
  const placeItem = useRoomStore((s) => s.placeItem);
  const removeItem = useRoomStore((s) => s.removeItem);
  const flipItem = useRoomStore((s) => s.flipItem);
  const save = useSavePlacements();
  const [roomArea, setRoomArea] = React.useState({ width: 0, height: 0 });
  const [notice, setNotice] = React.useState<string | null>(null);

  const handleRoomAreaLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setRoomArea({ width: Math.round(width), height: Math.round(height) });
  }, []);

  const roomWidth = roomArea.width > 0 && roomArea.height > 0 ? containSceneWidth(roomArea.width, roomArea.height) : 0;
  const selected = selectedId === null ? null : (placements.find((placement) => placement.itemId === selectedId) ?? null);
  const stored = storedFurnitures(furnitures.data ?? [], placements);

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

  const placeFromStorage = (furniture: StoredFurniture) => {
    const { draft } = useRoomStore.getState();
    if (!draft) return;
    const placement = placeNewItem(draft, furniture.itemId, furniture.userFurnitureId);
    if (!placement) {
      setNotice(NO_ROOM_NOTICE);
      return;
    }
    setNotice(null);
    placeItem(placement);
  };
  const flipSelected = () => {
    if (selectedId === null) return;
    setNotice(flipItem(selectedId) ? null : NO_TURN_NOTICE);
  };
  const storeSelected = () => {
    if (selectedId === null) return;
    setNotice(null);
    removeItem(selectedId);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={EDIT_TITLE} onBack={cancel} />
      {/* 방이 세로로 길어져(327:586) 폭을 꽉 채우면 화면을 넘겨 버튼이 밀린다 — 남은 영역 안에 방 전체가 들어가게 줄인다 (2026-09-18) */}
      <View className="flex-1 items-center justify-center" onLayout={handleRoomAreaLayout}>
        <RoomView accessibilityLabel={EDIT_ROOM_LABEL} locked width={roomWidth > 0 ? roomWidth : undefined} />
      </View>
      {selected === null ? (
        <Text className="px-6 pt-3 text-center text-body-sm text-card-foreground">{EDIT_HINT}</Text>
      ) : (
        <SelectionBar
          selected={selected}
          owned={furnitures.data}
          disabled={save.isPending}
          onFlip={flipSelected}
          onStoreAway={storeSelected}
        />
      )}
      {notice === null ? null : (
        <View className="flex-row items-center gap-1.5 px-6 pt-2" accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size={16} className="text-card-foreground" />
          <Text className="shrink text-caption text-card-foreground">{notice}</Text>
        </View>
      )}
      <StorageTray
        stored={stored}
        pending={furnitures.isPending}
        failed={furnitures.isError}
        retrying={furnitures.isFetching}
        disabled={save.isPending}
        onRetry={() => furnitures.refetch()}
        onPlace={placeFromStorage}
      />
      {save.isError ? (
        <View className="flex-row items-center gap-1.5 px-6 pt-2" accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size={16} className="text-destructive" />
          <Text className="shrink text-caption text-destructive">{EDIT_SAVE_ERROR}</Text>
        </View>
      ) : null}
      <View className="flex-row gap-2 px-6 pb-8 pt-3">
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

type SelectionBarProps = {
  selected: Placement;
  owned: readonly UserFurniture[] | undefined;
  disabled: boolean;
  onFlip: () => void;
  onStoreAway: () => void;
};

// 방에서 고른 것 하나에 대한 동작. 벽 기능 오브젝트는 돌리지도 넣어 두지도 않고, 기본 가구는 넣어 두지 못한다 — 막힌 이유를 글로 적는다.
function SelectionBar({ selected, owned, disabled, onFlip, onStoreAway }: SelectionBarProps) {
  const name = owned?.find((furniture) => furniture.userFurnitureId === selected.userFurnitureId)?.name ?? roomItemName(selected.itemId);
  const flippable = !isWallItemId(selected.itemId);
  const block = storeAwayBlock(selected, owned);

  return (
    <View className="gap-1 px-6 pt-3">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-label text-foreground" numberOfLines={1}>
          {name}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          className="h-button-md rounded-lg sm:h-button-md"
          onPress={onFlip}
          disabled={disabled || !flippable}
          accessibilityState={{ disabled: disabled || !flippable }}
          accessibilityLabel={`${name} 방향 바꾸기`}
        >
          <Icon as={FlipHorizontal2} size={16} className="text-secondary-foreground" />
          <Text>방향 바꾸기</Text>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-button-md rounded-lg sm:h-button-md"
          onPress={onStoreAway}
          disabled={disabled || block !== null}
          accessibilityState={{ disabled: disabled || block !== null }}
          accessibilityLabel={`${name} 넣어 두기`}
        >
          <Icon as={Archive} size={16} className="text-secondary-foreground" />
          <Text>넣어 두기</Text>
        </Button>
      </View>
      {block === null ? null : <Text className="text-caption text-card-foreground">{STORE_AWAY_BLOCK_TEXT[block]}</Text>}
    </View>
  );
}

type StorageTrayProps = {
  stored: StoredFurniture[];
  pending: boolean;
  failed: boolean;
  retrying: boolean;
  disabled: boolean;
  onRetry: () => void;
  onPlace: (furniture: StoredFurniture) => void;
};

const TRAY_SKELETON = [1, 2, 3, 4];

// 산 뒤 아직 방에 없는 가구. 누르면 빈 칸에 놓이고 골라진 상태가 되어 바로 끌어 옮길 수 있다.
function StorageTray({ stored, pending, failed, retrying, disabled, onRetry, onPlace }: StorageTrayProps) {
  return (
    <View className="gap-2 pt-4">
      <View className="flex-row items-center justify-between px-6">
        <Text className="text-label text-foreground">{STORAGE_TITLE}</Text>
        {pending || failed ? null : <Text className="text-caption tabular-nums text-card-foreground">{stored.length}개</Text>}
      </View>
      {pending ? (
        <View className="flex-row gap-3 px-6" accessible accessibilityLabel="보관함을 불러오는 중">
          {TRAY_SKELETON.map((key) => (
            <Skeleton key={key} className="h-16 w-16 rounded-xl" />
          ))}
        </View>
      ) : failed ? (
        <View className="flex-row items-center gap-2 px-6" accessibilityLiveRegion="polite">
          <Text className="flex-1 text-caption text-card-foreground">보관함을 불러오지 못했어요.</Text>
          <Button variant="ghost" size="sm" className="h-button-md sm:h-button-md" onPress={onRetry} disabled={retrying}>
            <Text>다시 시도</Text>
          </Button>
        </View>
      ) : stored.length === 0 ? (
        <Text className="px-6 text-caption text-card-foreground">보관 중인 가구가 없어요. 상점에서 산 가구가 여기에 생겨요.</Text>
      ) : (
        <FlatList
          horizontal
          data={stored}
          keyExtractor={(furniture) => String(furniture.userFurnitureId)}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-6"
          renderItem={({ item }) => <StoredTile furniture={item} disabled={disabled} onPress={onPlace} />}
        />
      )}
    </View>
  );
}

function StoredTile({ furniture, disabled, onPress }: { furniture: StoredFurniture; disabled: boolean; onPress: (furniture: StoredFurniture) => void }) {
  const thumbnail = roomItemThumbnail(furniture.assetKey);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${furniture.name}, 방에 놓기`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPress(furniture)}
      className="w-16 items-center gap-1 active:opacity-80"
    >
      <View className="h-16 w-16 items-center justify-center rounded-xl bg-muted" accessible={false}>
        {thumbnail === null ? (
          <Icon as={Sofa} size={24} className="text-card-foreground" />
        ) : (
          <Image source={thumbnail} style={TRAY_SPRITE_STYLE} resizeMode="contain" accessible={false} />
        )}
      </View>
      <Text className="text-caption text-card-foreground" numberOfLines={1}>
        {furniture.name}
      </Text>
    </Pressable>
  );
}

export { RoomEditScreen };
