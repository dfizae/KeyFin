import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Coins, Store, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { homeSummaryQueryOptions } from "@/features/home/api/queries";
import { BudgetCard } from "@/features/home/components/BudgetCard";
import { CharacterRoom } from "@/features/home/components/CharacterRoom";
import type { HomeSummary } from "@/features/home/model";
import { formatKRW } from "@/lib/money";

// TBD: 캐릭터 등록 화면(Pencil '캐릭터 입주중' PGyNo 흐름)의 라우트는 아직 없다. 라우트가 생기면 이 상수만 바꾼다.
const REGISTER_CHARACTER_ROUTE = "/character/register";

function HomeScreen() {
  const summary = useQuery(homeSummaryQueryOptions());
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="flex-grow pb-6">
      {summary.isPending ? <HomeSkeleton /> : null}
      {summary.isError ? (
        <View className="flex-1 px-6 pt-6">
          <EmptyState
            icon={WifiOff}
            title="정보를 불러오지 못했어요"
            description="연결 상태를 확인한 뒤 다시 시도해 주세요."
            action={{ label: "다시 시도", onPress: () => summary.refetch(), disabled: summary.isFetching }}
          />
        </View>
      ) : null}
      {summary.isSuccess ? (
        <HomeContent summary={summary.data} onRegisterPress={() => router.push(REGISTER_CHARACTER_ROUTE)} />
      ) : null}
    </ScrollView>
  );
}

type HomeContentProps = {
  summary: HomeSummary;
  onRegisterPress: () => void;
};

function HomeContent({ summary, onRegisterPress }: HomeContentProps) {
  const hasCharacter = summary.character !== null;

  return (
    <>
      <HomeHeader
        userName={summary.userName}
        coinBalance={summary.coinBalance}
        badgeCount={summary.unreadNotificationCount}
        showCoins={hasCharacter}
      />
      <CharacterRoom character={summary.character} onRegisterPress={onRegisterPress} />
      {hasCharacter && summary.monthlyBudget ? (
        <View className="px-6 pt-6">
          <BudgetCard budget={summary.monthlyBudget} />
        </View>
      ) : null}
    </>
  );
}

type HomeHeaderProps = {
  userName: string;
  coinBalance: number;
  badgeCount: number;
  showCoins: boolean;
};

// Pencil HomeHeader (MVL0x / FDV3H): padding [16,24] · space_between · 좌측 caption+h2 · 우측 HeaderActions gap 8.
// Pencil 의 빈 방 홈(hcONw)에는 HeaderActions 가 없지만 상점 버튼은 캐릭터 유무와 무관하게 두고, 코인 배지만 캐릭터가 있을 때 보인다. (확인 필요)
function HomeHeader({ userName, coinBalance, badgeCount, showCoins }: HomeHeaderProps) {
  return (
    <View className="flex-row items-center justify-between bg-background px-6 py-4">
      <View className="gap-1">
        <Text className="text-caption text-muted-foreground">환영합니다</Text>
        <Text className="text-h2 text-foreground" accessibilityRole="header">
          {userName}님, 안녕하세요!
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {showCoins ? <CoinBadge balance={coinBalance} /> : null}
        <ShopButton badgeCount={badgeCount} />
      </View>
    </View>
  );
}

// Pencil CoinBadge (DsQOx): bg-accent 알약 · 16pt 노란 원(#F5D547 — 토큰 없음, warning 으로 대체) · 14/500 숫자.
function CoinBadge({ balance }: { balance: number }) {
  const text = formatKRW(String(balance), { unit: false });

  return (
    <View className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-1" accessible accessibilityLabel={`코인 ${text}개`}>
      <View className="h-4 w-4 items-center justify-center rounded-full bg-warning" accessible={false}>
        <Icon as={Coins} size={10} className="text-foreground" />
      </View>
      <Text className="text-label tabular-nums text-foreground">{text}</Text>
    </View>
  );
}

// Pencil NotificationBtn (paMoc): 40pt 원형 bg-accent, 안의 아이콘은 lucide `store`, 우상단 배지 bg-destructive.
// 레이어 이름은 Notification 이지만 아이콘은 상점이라 상점 버튼으로 구현했다. 배지 수는 미읽음 알림 수를 쓴다. (확인 필요)
function ShopButton({ badgeCount }: { badgeCount: number }) {
  const label = badgeCount > 0 ? `상점, 새 소식 ${badgeCount}개` : "상점";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className="h-10 w-10 items-center justify-center rounded-full bg-accent active:opacity-70"
    >
      <Icon as={Store} size={20} className="text-foreground" />
      {badgeCount > 0 ? (
        <View
          className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1"
          accessible={false}
        >
          <Text className="text-caption text-white">{badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const ROOM_SKELETON_ASPECT_RATIO = 327 / 404;

function HomeSkeleton() {
  return (
    <View className="flex-1" accessibilityLabel="불러오는 중" accessible>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-48" />
        </View>
        <Skeleton className="h-10 w-10 rounded-full" />
      </View>
      <View className="px-6">
        <Skeleton className="w-full rounded-xl" style={{ aspectRatio: ROOM_SKELETON_ASPECT_RATIO }} />
      </View>
      <View className="px-6 pt-6">
        <Skeleton className="h-40 w-full rounded-xl" />
      </View>
    </View>
  );
}

export { HomeScreen };
