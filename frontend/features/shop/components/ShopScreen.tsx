import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Coins, Store, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Screen, ScreenFlatList } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { roomKeys } from "@/features/room/api/queries";
import { useCoinBalance, usePurchaseShopItem, useShopItems } from "@/features/shop/api/queries";
import { shopCategoryIcon, shopItemSprite, shopSlotLabel } from "@/features/shop/catalog";
import { shopPurchaseErrorMessage } from "@/features/shop/errors";
import {
  canBuyShopItem,
  coinCountLabel,
  shopItemsInSlot,
  shopPriceLabel,
  shopSlotTabs,
  type ShopItem,
  type ShopSlot,
} from "@/features/shop/model";
import { cn } from "@/lib/utils";

const HOME_ROUTE = "/";
const FIRST_SLOT: ShopSlot = "HEAD";
/** 그림은 4px 스케일 밖 크기라 style 로 준다 (BankLogoTile 과 같은 방식) */
const SPRITE_STYLE = { width: 72, height: 72 } as const;

/**
 * PAGE-29 상점 (FR-GAM-05, P1). 홈 상점 버튼에서 들어온다.
 * `GET /shop` 은 판매 중인 상품을 한 번에 주므로(페이지 없음) 한 번 받아 슬롯 탭으로 나눠 보여 준다 — 탭을 옮겨도 다시 부르지 않는다.
 * 구매는 코인이 빠지는 일이라 확인 창을 거치고, 요청 중에는 창을 닫지도 다시 누르지도 못한다 (규칙 80).
 * 보유한 상품은 누를 수 없고(서버도 409 SHOP_002 로 막는다), 코인이 모자라면 가격 옆에 이유를 적는다.
 * Pencil 시안 없음 — design/DESIGN.md 의 카드·칩 규칙을 따랐다.
 */
function ShopScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const items = useShopItems();
  const balance = useCoinBalance();
  const purchase = usePurchaseShopItem();
  const [slot, setSlot] = React.useState<ShopSlot>(FIRST_SLOT);
  const [target, setTarget] = React.useState<ShopItem | null>(null);

  const all = items.data ?? [];
  const shown = shopItemsInSlot(all, slot);

  const openPurchase = (item: ShopItem) => {
    purchase.reset();
    setTarget(item);
  };

  const closePurchase = () => {
    if (purchase.isPending) return;
    purchase.reset();
    setTarget(null);
  };

  const confirmPurchase = () => {
    if (target === null || purchase.isPending) return;
    purchase.mutate(
      { itemId: target.itemId },
      {
        onSuccess: () => {
          setTarget(null);
          // 가구를 사면 방 꾸미기 목록에도 생긴다. 방 쿼리가 이미 shopKeys 를 쓰고 있어 반대 방향 import 는 순환이라 여기서 무효화한다.
          void queryClient.invalidateQueries({ queryKey: roomKeys.all });
        },
      }
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title="상점"
        onBack={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))}
        right={<CoinBadge balance={balance.data} pending={balance.isPending} />}
      />

      <SlotTabs tabs={shopSlotTabs(all)} value={slot} onChange={setSlot} />

      {items.isPending ? (
        <ShopSkeleton />
      ) : items.data === undefined ? (
        <EmptyState
          icon={WifiOff}
          title="상점을 불러오지 못했어요"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onPress: () => items.refetch(), disabled: items.isFetching }}
        />
      ) : (
        <ScreenFlatList
          overlapHeader={false}
          data={shown}
          numColumns={2}
          keyExtractor={(item) => String(item.itemId)}
          renderItem={({ item }) => <ShopItemCard item={item} balance={balance.data} onPress={openPurchase} />}
          columnWrapperClassName="gap-3"
          contentContainerClassName="gap-3 px-6 pb-8"
          refreshing={items.isRefetching}
          onRefresh={() => items.refetch()}
          ListEmptyComponent={
            <EmptyState icon={Store} title="이 자리에 파는 상품이 없어요" description="다른 탭을 골라 보세요." />
          }
        />
      )}

      <PurchaseDialog
        item={target}
        balance={balance.data}
        pending={purchase.isPending}
        error={purchase.isError ? shopPurchaseErrorMessage(purchase.error) : null}
        onCancel={closePurchase}
        onConfirm={confirmPurchase}
      />
    </Screen>
  );
}

// 헤더 오른쪽 보유 코인. 코인 이력(PAGE-30)과 같은 노란 코인 원이다.
function CoinBadge({ balance, pending }: { balance: number | undefined; pending: boolean }) {
  const count = balance === undefined ? null : coinCountLabel(balance);

  return (
    <View
      className="h-9 flex-row items-center gap-1.5 rounded-full bg-accent px-3"
      accessible={count !== null}
      accessibilityLabel={count === null ? undefined : `보유 코인 ${count}개`}
      accessibilityLiveRegion="polite"
    >
      <View className="h-5 w-5 items-center justify-center rounded-full bg-warning" accessible={false}>
        <Icon as={Coins} size={12} className="text-foreground" />
      </View>
      {pending ? <Skeleton className="h-4 w-10 rounded-sm" /> : <Text className="text-label tabular-nums text-foreground">{count ?? "—"}</Text>}
    </View>
  );
}

type SlotTabsProps = {
  tabs: readonly ShopSlot[];
  value: ShopSlot;
  onChange: (slot: ShopSlot) => void;
};

function SlotTabs({ tabs, value, onChange }: SlotTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6 pb-4">
      {tabs.map((tab) => {
        const selected = tab === value;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => onChange(tab)}
            className={cn("h-touch justify-center rounded-full px-4 active:opacity-80", selected ? "bg-primary" : "bg-muted")}
          >
            <Text className={cn("text-label", selected ? "text-primary-foreground" : "text-card-foreground")}>{shopSlotLabel(tab)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type ShopItemCardProps = {
  item: ShopItem;
  balance: number | undefined;
  onPress: (item: ShopItem) => void;
};

// 이미 가졌거나 코인이 모자라면 누를 수 없다 — 상태를 색만으로 전하지 않고 가격 자리의 문구로도 적는다 (규칙 40).
function ShopItemCard({ item, balance, onPress }: ShopItemCardProps) {
  const sprite = shopItemSprite(item.assetKey);
  const buyable = canBuyShopItem(item, balance);
  const price = shopPriceLabel(item.price);
  const shortage = !item.owned && !buyable;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.price === 0 ? "무료" : `${price}코인`}${item.owned ? ", 보유 중" : shortage ? ", 코인 부족" : ""}`}
      accessibilityState={{ disabled: !buyable }}
      disabled={!buyable}
      onPress={() => onPress(item)}
      className={cn(
        "flex-1 gap-2 rounded-2xl bg-card p-3 shadow shadow-black/10 active:opacity-80 dark:border dark:border-border dark:shadow-none",
        item.owned && "opacity-60"
      )}
    >
      <View className="h-24 items-center justify-center rounded-xl bg-muted" accessible={false}>
        {sprite === null ? (
          <Icon as={shopCategoryIcon(item.category)} size={28} className="text-card-foreground" />
        ) : (
          <Image source={sprite} style={SPRITE_STYLE} resizeMode="contain" accessible={false} />
        )}
      </View>
      <Text className="text-body-sm text-foreground" numberOfLines={1}>
        {item.name}
      </Text>
      <View className="flex-row items-center gap-1.5">
        {item.owned ? null : <Icon as={Coins} size={14} className="text-warning" />}
        <Text className={cn("text-label tabular-nums", buyable ? "text-foreground" : "text-card-foreground")}>
          {item.owned ? "보유 중" : price}
        </Text>
        {shortage ? <Text className="text-caption text-card-foreground">코인 부족</Text> : null}
      </View>
    </Pressable>
  );
}

type PurchaseDialogProps = {
  item: ShopItem | null;
  balance: number | undefined;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

// 코인이 빠지는 일이라 무엇을 얼마에 사는지, 사고 나면 얼마가 남는지 보여 준 뒤에만 보낸다.
function PurchaseDialog({ item, balance, pending, error, onCancel, onConfirm }: PurchaseDialogProps) {
  if (item === null) return null;
  const after = balance === undefined ? null : coinCountLabel(balance - item.price);

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-h3 text-foreground">{item.name} 살까요?</DialogTitle>
          <DialogDescription className="text-body-sm text-card-foreground">
            {item.price === 0 ? "무료 상품이에요." : `${shopPriceLabel(item.price)}코인이 빠져나가요.`}
            {after === null ? "" : ` 사고 나면 ${after}코인이 남아요.`} 산 뒤에는 옷장이나 방 꾸미기에서 직접 입히거나 놓을 수 있어요.
          </DialogDescription>
        </DialogHeader>
        {error === null ? null : (
          <View className="rounded-lg bg-destructive-muted p-3.5" accessibilityLiveRegion="polite">
            <Text className="text-caption text-foreground">{error}</Text>
          </View>
        )}
        <DialogFooter>
          <Button variant="secondary" disabled={pending} onPress={onCancel}>
            <Text>취소</Text>
          </Button>
          <Button disabled={pending} onPress={onConfirm}>
            <Text>{pending ? "구매 중" : "구매"}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SKELETON_ROWS = [1, 2, 3];

function ShopSkeleton() {
  return (
    <View className="gap-3 px-6" accessible accessibilityLabel="불러오는 중">
      {SKELETON_ROWS.map((row) => (
        <View key={row} className="flex-row gap-3">
          <Skeleton className="h-40 flex-1 rounded-2xl" />
          <Skeleton className="h-40 flex-1 rounded-2xl" />
        </View>
      ))}
    </View>
  );
}

export { ShopScreen };
