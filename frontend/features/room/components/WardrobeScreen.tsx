import { useRouter } from "expo-router";
import { Shirt, Store, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Screen, ScreenFlatList } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useUpdateItemEquipment, useUserItems } from "@/features/room/api/queries";
import { itemEquipmentErrorMessage } from "@/features/room/errors";
import { AVATAR_SLOTS, equippedItemInSlot, userItemsInSlot, type AvatarSlot, type UserItem } from "@/features/room/items";
import { cn } from "@/lib/utils";

const HOME_ROUTE = "/";
const SHOP_ROUTE = "/shop";
const FIRST_SLOT: AvatarSlot = "HEAD";

/** 부위 이름. 부위 값은 계약이고 이름은 클라이언트 상수다 */
const SLOT_LABELS: Record<AvatarSlot, string> = {
  HEAD: "머리",
  FACE: "얼굴",
  UPPER_BODY: "상의",
  LOWER_BODY: "하의",
  SOCKS: "양말",
  FOOTWEAR: "신발",
};

/**
 * 옷장 (FR-GAM-05, P1). 홈 옷장 버튼에서 들어오며 명세에 독립 PAGE 번호는 없다.
 * `GET /items` 는 보유 아이템을 한 번에 주므로(페이지 없음) 한 번 받아 부위 탭으로 나눈다.
 * 누르면 바로 입고 다시 누르면 벗는다 — 코인이 들지 않고 되돌릴 수 있어 확인 창을 두지 않는다.
 * 같은 부위의 기존 아이템은 서버가 자동으로 벗기므로, 응답(전체 착장)으로 목록을 다시 맞춘다.
 * 아바타 파츠 에셋이 아직 없어 그림 자리에는 아이콘을 둔다 (frontend-spec §6 #8).
 * Pencil 시안 없음 — design/DESIGN.md 의 카드·칩 규칙을 따랐다.
 */
function WardrobeScreen() {
  const router = useRouter();
  const items = useUserItems();
  const equipment = useUpdateItemEquipment();
  const [slot, setSlot] = React.useState<AvatarSlot>(FIRST_SLOT);

  const all = items.data ?? [];
  const shown = userItemsInSlot(all, slot);
  const wearing = equippedItemInSlot(all, slot);
  const changingId = equipment.isPending ? equipment.variables.userItemId : null;

  const toggle = (item: UserItem) => {
    if (equipment.isPending) return;
    equipment.mutate({ userItemId: item.userItemId, equipped: !item.equipped });
  };

  return (
    <Screen>
      <ScreenHeader title="옷장" onBack={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))} />

      <SlotTabs value={slot} onChange={setSlot} />

      {equipment.isError ? (
        <View className="mx-6 mb-3 rounded-lg bg-destructive-muted p-3.5" accessibilityLiveRegion="polite">
          <Text className="text-caption text-foreground">{itemEquipmentErrorMessage(equipment.error)}</Text>
        </View>
      ) : null}

      {items.isPending ? (
        <WardrobeSkeleton />
      ) : items.data === undefined ? (
        <EmptyState
          icon={WifiOff}
          title="옷장을 불러오지 못했어요"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onPress: () => items.refetch(), disabled: items.isFetching }}
        />
      ) : (
        <ScreenFlatList
          overlapHeader={false}
          data={shown}
          numColumns={2}
          keyExtractor={(item) => String(item.userItemId)}
          renderItem={({ item }) => (
            <ItemCard item={item} changing={item.userItemId === changingId} disabled={equipment.isPending} onPress={toggle} />
          )}
          columnWrapperClassName="gap-3"
          contentContainerClassName="gap-3 px-6 pb-8"
          ListHeaderComponent={<WearingLine slot={slot} wearing={wearing} />}
          refreshing={items.isRefetching}
          onRefresh={() => items.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon={Store}
              title="이 부위에 가진 옷이 없어요"
              description="상점에서 코인으로 옷을 살 수 있어요."
              action={{ label: "상점 가기", onPress: () => router.push(SHOP_ROUTE) }}
            />
          }
        />
      )}
    </Screen>
  );
}

// 지금 입은 것을 한 줄로 알려 준다 — 카드의 '착용 중' 뱃지만으로는 목록을 훑어야 알 수 있다.
function WearingLine({ slot, wearing }: { slot: AvatarSlot; wearing: UserItem | null }) {
  return (
    <Text className="pb-1 text-body-sm text-card-foreground" accessibilityLiveRegion="polite">
      {wearing === null ? `${SLOT_LABELS[slot]}는 기본 차림이에요.` : `지금 ${wearing.name}을 입고 있어요.`}
    </Text>
  );
}

function SlotTabs({ value, onChange }: { value: AvatarSlot; onChange: (slot: AvatarSlot) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6 pb-4">
      {AVATAR_SLOTS.map((slot) => {
        const selected = slot === value;
        return (
          <Pressable
            key={slot}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => onChange(slot)}
            className={cn("h-touch justify-center rounded-full px-4 active:opacity-80", selected ? "bg-primary" : "bg-muted")}
          >
            <Text className={cn("text-label", selected ? "text-primary-foreground" : "text-card-foreground")}>{SLOT_LABELS[slot]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type ItemCardProps = {
  item: UserItem;
  /** 이 카드가 지금 바뀌는 중 */
  changing: boolean;
  /** 다른 카드가 바뀌는 중이라 잠깐 누를 수 없다 */
  disabled: boolean;
  onPress: (item: UserItem) => void;
};

// 입은 것은 테두리와 '착용 중' 문구로 함께 표시한다 — 색만으로 전하지 않는다 (규칙 40).
function ItemCard({ item, changing, disabled, onPress }: ItemCardProps) {
  const state = changing ? "바꾸는 중" : item.equipped ? "착용 중" : "누르면 입어요";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.equipped ? "착용 중" : "벗은 상태"}`}
      accessibilityHint={item.equipped ? "누르면 벗어요" : "누르면 입어요"}
      accessibilityState={{ selected: item.equipped, disabled, busy: changing }}
      disabled={disabled}
      onPress={() => onPress(item)}
      className={cn(
        "flex-1 gap-2 rounded-2xl bg-card p-3 shadow shadow-black/10 active:opacity-80 dark:border dark:border-border dark:shadow-none",
        item.equipped && "border-2 border-primary",
        disabled && !changing && "opacity-60"
      )}
    >
      <View className="h-24 items-center justify-center rounded-xl bg-muted" accessible={false}>
        <Icon as={Shirt} size={28} className={item.equipped ? "text-primary" : "text-card-foreground"} />
      </View>
      <Text className="text-body-sm text-foreground" numberOfLines={1}>
        {item.name}
      </Text>
      <Text className={cn("text-caption", item.equipped ? "text-primary" : "text-card-foreground")}>{state}</Text>
    </Pressable>
  );
}

const SKELETON_ROWS = [1, 2];

function WardrobeSkeleton() {
  return (
    <View className="gap-3 px-6" accessible accessibilityLabel="불러오는 중">
      <Skeleton className="h-5 w-40 rounded-sm" />
      {SKELETON_ROWS.map((row) => (
        <View key={row} className="flex-row gap-3">
          <Skeleton className="h-40 flex-1 rounded-2xl" />
          <Skeleton className="h-40 flex-1 rounded-2xl" />
        </View>
      ))}
    </View>
  );
}

export { WardrobeScreen };
