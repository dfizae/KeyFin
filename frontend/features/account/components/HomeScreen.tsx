import { useQuery } from "@tanstack/react-query";
import { Bell, Inbox, User, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { homeSummaryQueryOptions } from "@/features/account/api/queries";
import { AccountCard } from "@/features/account/components/AccountCard";
import { QuickMenu } from "@/features/account/components/QuickMenu";
import type { AccountSummary, HomeSummary } from "@/features/account/model";

function HomeScreen() {
  const summary = useQuery(homeSummaryQueryOptions());
  const [balanceHidden, setBalanceHidden] = React.useState(false);

  return (
    <ScrollView className="flex-1 bg-primary" contentContainerClassName="flex-grow">
      {summary.isPending ? <HomeSkeleton /> : null}
      {summary.isError ? (
        <HomeBody>
          <EmptyState
            icon={WifiOff}
            title="정보를 불러오지 못했어요"
            description="연결 상태를 확인한 뒤 다시 시도해 주세요."
            action={{ label: "다시 시도", onPress: () => summary.refetch(), disabled: summary.isFetching }}
          />
        </HomeBody>
      ) : null}
      {summary.isSuccess ? (
        <HomeContent
          summary={summary.data}
          balanceHidden={balanceHidden}
          onToggleBalanceHidden={() => setBalanceHidden((hidden) => !hidden)}
        />
      ) : null}
    </ScrollView>
  );
}

type HomeContentProps = {
  summary: HomeSummary;
  balanceHidden: boolean;
  onToggleBalanceHidden: () => void;
};

function HomeContent({ summary, balanceHidden, onToggleBalanceHidden }: HomeContentProps) {
  return (
    <>
      <HomeHeader userName={summary.userName} unreadCount={summary.unreadNotificationCount} />
      <HomeBody>
        {summary.primaryAccount ? (
          <AccountCardStack
            account={summary.primaryAccount}
            balanceHidden={balanceHidden}
            onToggleBalanceHidden={onToggleBalanceHidden}
          />
        ) : (
          <EmptyState icon={Inbox} title="연결된 계좌가 없어요" description="계좌를 연결하면 잔액을 여기서 볼 수 있어요." />
        )}
        <QuickMenu />
      </HomeBody>
    </>
  );
}

function HomeBody({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 gap-8 bg-background px-6 pb-10 pt-6">{children}</View>;
}

type HomeHeaderProps = {
  userName: string;
  unreadCount: number;
};

function HomeHeader({ userName, unreadCount }: HomeHeaderProps) {
  const notificationLabel = unreadCount > 0 ? `알림 ${unreadCount}개` : "알림";

  return (
    <View className="flex-row items-center gap-4 bg-primary px-6 pb-6 pt-4">
      <View className="h-avatar w-avatar items-center justify-center rounded-full bg-white" accessible={false}>
        <Icon as={User} size={26} className="text-primary" />
      </View>
      <Text className="flex-1 text-h3 text-primary-foreground" accessibilityRole="header">
        안녕하세요, {userName}님
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={notificationLabel}
        hitSlop={8}
        className="h-touch w-touch items-center justify-center rounded-full active:bg-white/20"
      >
        <Icon as={Bell} size={24} className="text-primary-foreground" />
        {unreadCount > 0 ? (
          <View className="absolute right-1 top-1 min-w-4 items-center rounded-full bg-destructive px-1">
            <Text className="text-caption text-destructive-foreground">{unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

type AccountCardStackProps = {
  account: AccountSummary;
  balanceHidden: boolean;
  onToggleBalanceHidden: () => void;
};

function AccountCardStack({ account, balanceHidden, onToggleBalanceHidden }: AccountCardStackProps) {
  return (
    <View>
      <AccountCard account={account} balanceHidden={balanceHidden} onToggleBalanceHidden={onToggleBalanceHidden} />
      <View className="mx-5 h-2 rounded-b-lg bg-destructive" accessible={false} />
      <View className="mx-8 h-2 rounded-b-lg bg-primary/60" accessible={false} />
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View className="flex-1" accessibilityLabel="불러오는 중" accessible>
      <View className="flex-row items-center gap-4 bg-primary px-6 pb-6 pt-4">
        <Skeleton className="h-avatar w-avatar rounded-full bg-white/30" />
        <Skeleton className="h-6 flex-1 bg-white/30" />
      </View>
      <HomeBody>
        <Skeleton className="h-52 w-full rounded-lg" />
        <View className="-m-2 flex-row flex-wrap">
          {Array.from({ length: 9 }, (_, index) => (
            <View key={index} className="w-1/3 p-2">
              <Skeleton className="aspect-square rounded-lg" />
            </View>
          ))}
        </View>
      </HomeBody>
    </View>
  );
}

export { HomeScreen };
