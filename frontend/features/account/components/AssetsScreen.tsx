import { useRouter } from "expo-router";
import { CalendarClock, CreditCard, Menu, Receipt, WalletMinimal } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAccounts } from "@/features/account/api/queries";
import { balanceAsOfLabel, linkedCards, totalBalance, type LinkedAccount, type LinkedCard } from "@/features/account/model";
import { useLinkCandidates } from "@/features/link/api/queries";
import { BankLogoTile } from "@/features/link/components/BankLogoTile";
import { CandidatesErrorState } from "@/features/link/components/CandidatesErrorState";
import { usePaymentCalendar } from "@/features/payment/api/queries";
import { upcomingEntries, type CalendarEntry } from "@/features/payment/model";
import { RECENT_TRANSACTION_COUNT, useRecentTransactions } from "@/features/transaction/api/queries";
import { TransactionRow } from "@/features/transaction/components/TransactionRow";
import { currentDateKey, currentMonthKey, formatMonthDay, parseKSTDateKey } from "@/lib/date";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

const TRANSACTIONS_ROUTE = "/transaction";

/** 시안(UjYhB)은 2건을 보여 준다. 남은 건이 많아도 가까운 순으로 이만큼만 둔다 */
const UPCOMING_PAYMENT_LIMIT = 3;

type AssetTab = "accounts" | "cards";

const ASSET_TABS: { key: AssetTab; label: string }[] = [
  { key: "accounts", label: "계좌" },
  { key: "cards", label: "카드" },
];

// PAGE-11 자산 (Pencil 자산관리 UjYhB). 사용자 결정(2026-09-11): 대출 탭·송금 버튼은 KeyFin 명세에 없어 빼고,
// 햄버거는 자리만 두고 비활성, 정기결제 예정은 넣되 '관리'는 결제 캘린더(PAGE-24)가 생기기 전까지 숨긴다.
// 계좌는 GET /accounts(잔액 스냅샷), 카드는 카드 API 가 없어 금융망 후보에서 온다 — 카드 탭을 열 때만 금융망을 부른다.
// 섹션마다 따로 불러와 한쪽이 실패해도 나머지는 보인다.
function AssetsScreen() {
  const [tab, setTab] = React.useState<AssetTab>("accounts");
  const accounts = useAccounts();
  // 잔액은 실시간이 아니라 서버가 갱신한 스냅샷이라 기준 시각을 함께 보여 준다 (사용자 결정 2026-09-12)
  const asOf = accounts.data ? balanceAsOfLabel(accounts.data) : null;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-8">
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-h1 text-foreground" accessibilityRole="header">
          자산관리
        </Text>
        <MenuButton />
      </View>

      <View className="gap-1 px-6 pb-4">
        <Text className="text-caption text-muted-foreground">내 총 자산</Text>
        {accounts.isPending ? (
          <Skeleton className="h-11 w-48 rounded-md" />
        ) : (
          <Text className="text-amount-lg tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
            {accounts.data === undefined ? "—" : formatKRW(totalBalance(accounts.data))}
          </Text>
        )}
        {asOf === null ? null : <Text className="text-caption tabular-nums text-muted-foreground">{asOf}</Text>}
      </View>

      <View className="flex-row gap-2 px-6 pb-5" accessibilityRole="tablist">
        {ASSET_TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            className={cn("h-10 flex-1 items-center justify-center rounded-md", tab === key ? "bg-primary" : "bg-accent")}
          >
            <Text className={cn("text-label", tab === key ? "text-primary-foreground" : "text-muted-foreground")}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View className="gap-3 px-6">
        <Text className="text-h3 text-foreground" accessibilityRole="header">
          {tab === "accounts" ? "입출금 계좌" : "카드"}
        </Text>
        {tab === "accounts" ? (
          accounts.isPending ? (
            <AssetSkeleton />
          ) : accounts.isError ? (
            <InlineRetry message="계좌를 불러오지 못했어요." retrying={accounts.isFetching} onRetry={() => accounts.refetch()} />
          ) : (
            <AccountList accounts={accounts.data} />
          )
        ) : (
          <CardSection />
        )}
      </View>

      <UpcomingPayments />
      <RecentTransactions />
    </ScrollView>
  );
}

// Pencil menu (S7AAx). 예산 탭과 같이 동작이 명세에 없어 자리만 두고 비활성으로 둔다. (TBD)
function MenuButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="메뉴" accessibilityState={{ disabled: true }} disabled hitSlop={10}>
      <Icon as={Menu} size={24} className="text-foreground" />
    </Pressable>
  );
}

// Pencil AccountItem (w4jgr1): accent 카드. 송금 버튼 대신 로고 타일과 마스킹 번호를 둔다.
// 별칭이 있으면 제목으로 올리고 은행명은 아래로 내린다. 수입 계좌에는 뱃지를 단다.
function AccountList({ accounts }: { accounts: LinkedAccount[] }) {
  if (accounts.length === 0) {
    return <EmptyState icon={WalletMinimal} title="연결된 계좌가 없어요" className="py-6" />;
  }
  return (
    <View className="gap-2">
      {accounts.map((account) => (
        <View
          key={account.accountId}
          className="flex-row items-center gap-3 rounded-lg bg-accent p-4"
          accessible
          accessibilityLabel={[
            account.alias ?? account.bankName,
            account.isIncome ? "수입 계좌" : null,
            account.maskedNo,
            `잔액 ${formatKRW(account.balance)}`,
          ]
            .filter(Boolean)
            .join(", ")}
        >
          <BankLogoTile name={account.bankName} />
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-1.5">
              <Text className="shrink text-h3 text-foreground" numberOfLines={1}>
                {account.alias ?? account.bankName}
              </Text>
              {account.isIncome ? (
                <Badge variant="secondary">
                  <Text>수입</Text>
                </Badge>
              ) : null}
            </View>
            <Text className="text-caption tabular-nums text-muted-foreground" numberOfLines={1}>
              {account.alias === null ? account.maskedNo : `${account.bankName} · ${account.maskedNo}`}
            </Text>
          </View>
          <Text className="text-amount-sm tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
            {formatKRW(account.balance)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// 카드 목록 API 가 없어 금융망 후보의 연결 카드를 쓴다. 이 섹션이 보일 때만 후보를 불러온다.
function CardSection() {
  const candidates = useLinkCandidates();

  if (candidates.isPending) return <AssetSkeleton />;
  if (candidates.isError) {
    return <CandidatesErrorState error={candidates.error} retrying={candidates.isFetching} onRetry={() => candidates.refetch()} />;
  }
  return <CardList cards={linkedCards(candidates.data)} />;
}

function CardList({ cards }: { cards: LinkedCard[] }) {
  if (cards.length === 0) {
    return <EmptyState icon={CreditCard} title="연결된 카드가 없어요" className="py-6" />;
  }
  return (
    <View className="gap-2">
      {cards.map((card) => (
        <View
          key={card.cardId}
          className="flex-row items-center gap-3 rounded-lg bg-accent p-4"
          accessible
          accessibilityLabel={`${card.cardName} ${card.issuerName} ${card.maskedNo}`}
        >
          <BankLogoTile name={card.issuerName} />
          <View className="flex-1 gap-0.5">
            <Text className="text-h3 text-foreground" numberOfLines={1}>
              {card.cardName}
            </Text>
            <Text className="text-caption tabular-nums text-muted-foreground" numberOfLines={1}>
              {card.issuerName} · {card.maskedNo}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Pencil RecurringPayments (Csfwz). 데이터는 홈 캘린더와 같은 GET /payments/calendar 캐시를 쓴다.
function UpcomingPayments() {
  const calendar = usePaymentCalendar(currentMonthKey());
  const entries = calendar.data ? upcomingEntries(calendar.data, currentDateKey(), UPCOMING_PAYMENT_LIMIT) : [];

  return (
    <View className="gap-3 p-6">
      <Text className="text-h2 text-foreground" accessibilityRole="header">
        이번 달 정기결제 예정
      </Text>
      {calendar.isPending ? (
        <AssetSkeleton />
      ) : calendar.isError ? (
        <InlineRetry message="정기결제 일정을 불러오지 못했어요." retrying={calendar.isFetching} onRetry={() => calendar.refetch()} />
      ) : entries.length === 0 ? (
        <Text className="text-body-sm text-muted-foreground">이번 달 남은 정기결제가 없어요.</Text>
      ) : (
        <View className="gap-2">
          {entries.map((entry) => (
            <PaymentRow key={entry.key} entry={entry} />
          ))}
        </View>
      )}
    </View>
  );
}

function PaymentRow({ entry }: { entry: CalendarEntry }) {
  const date = formatMonthDay(parseKSTDateKey(entry.date));
  const amount = entry.estimated ? `${formatKRW(entry.amount)} 예정` : formatKRW(entry.amount);

  return (
    <View className="flex-row items-center justify-between gap-3 py-2" accessible accessibilityLabel={`${entry.name} ${date} ${amount}`}>
      <View className="flex-1 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-accent">
          <Icon as={entry.type === "CARD_BILL" ? CreditCard : CalendarClock} size={18} className="text-primary" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-h3 text-foreground" numberOfLines={1}>
            {entry.name}
          </Text>
          <Text className="text-caption text-muted-foreground">{date}</Text>
        </View>
      </View>
      <Text className="text-amount-sm tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
        {amount}
      </Text>
    </View>
  );
}

// Pencil RecentTransactions (ToBBS): 이번 달 최근 3건 + 전체보기(거래 내역 화면).
function RecentTransactions() {
  const router = useRouter();
  const recent = useRecentTransactions(currentMonthKey());

  return (
    <View className="gap-3 px-6 pt-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-h2 text-foreground" accessibilityRole="header">
          최근 거래 내역
        </Text>
        <Pressable accessibilityRole="link" accessibilityLabel="거래 내역 전체보기" hitSlop={10} onPress={() => router.push(TRANSACTIONS_ROUTE)}>
          <Text className="text-caption text-primary">전체보기</Text>
        </Pressable>
      </View>
      {recent.isPending ? (
        <View className="gap-2">
          {Array.from({ length: RECENT_TRANSACTION_COUNT }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-md" />
          ))}
        </View>
      ) : recent.isError ? (
        <InlineRetry message="거래 내역을 불러오지 못했어요." retrying={recent.isFetching} onRetry={() => recent.refetch()} />
      ) : recent.data.items.length === 0 ? (
        <EmptyState icon={Receipt} title="이번 달 거래가 아직 없어요" className="py-6" />
      ) : (
        <View>
          {recent.data.items.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </View>
      )}
    </View>
  );
}

type InlineRetryProps = {
  message: string;
  retrying: boolean;
  onRetry: () => void;
};

// 섹션 하나만 실패했을 때 그 자리에서 다시 부른다 (규칙 50: 일부 실패는 전체를 막지 않는다).
function InlineRetry({ message, retrying, onRetry }: InlineRetryProps) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3" accessibilityLiveRegion="polite">
      <Text className="flex-1 text-body-sm text-muted-foreground">{message}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: retrying }} disabled={retrying} hitSlop={10} onPress={onRetry}>
        <Text className={cn("text-label", retrying ? "text-muted-foreground" : "text-primary")}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const SKELETON_ROWS = [1, 2];

function AssetSkeleton() {
  return (
    <View className="gap-2" accessible accessibilityLabel="불러오는 중">
      {SKELETON_ROWS.map((row) => (
        <Skeleton key={row} className="h-16 w-full rounded-lg" />
      ))}
    </View>
  );
}

export { AssetsScreen };
