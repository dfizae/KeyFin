import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, WifiOff } from "lucide-react-native";
import { FlatList, Pressable, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { usePaymentCalendar } from "@/features/payment/api/queries";
import { CALENDAR_EMPTY_MESSAGE, PREPARED_LABEL } from "@/features/payment/components/CalendarPopover";
import { groupEntriesByDate, parseCalendarMonth, type CalendarDayGroup, type CalendarEntry } from "@/features/payment/model";
import { currentMonthKey, formatMonthDay, formatMonthKeyLabel, parseKSTDateKey, shiftMonthKey } from "@/lib/date";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

const HOME_ROUTE = "/";
const FIXED_EXPENSE_ROUTE = "/payment/fixed-expense";
const ESTIMATED_SUFFIX = "(예상)";

/**
 * PAGE-24 결제 캘린더. GET /payments/calendar 의 날짜별 출금 예정을 달 단위로 보여준다 (FR-PAY-01·02).
 * prepared·shortage·estimated 는 매일 06:00 배치가 계산하는 서버 값이라 그대로 표시만 한다 (규칙 80).
 * 고정지출(FIXED) 항목은 수정 화면(PAGE-26)으로 가고, 카드 청구(CARD_BILL)는 사용자가 고칠 수 없어 탭하지 않는다.
 * Pencil 시안 없음 — 달력 격자 대신 날짜별 목록으로 만든다(응답이 날짜·항목 목록이고 한 달 건수가 적다).
 */
function PaymentCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const month = parseCalendarMonth(params.month, currentMonthKey());
  const calendar = usePaymentCalendar(month);
  const groups = calendar.data ? groupEntriesByDate(calendar.data.entries) : [];

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-3 px-6 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            hitSlop={10}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))}
          >
            <Icon as={ChevronLeft} size={24} className="text-foreground" />
          </Pressable>
          <Text className="text-h3 text-foreground" accessibilityRole="header">
            결제 캘린더
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="고정지출 등록"
          hitSlop={10}
          className="h-touch w-touch items-center justify-center active:opacity-70"
          onPress={() => router.push(`${FIXED_EXPENSE_ROUTE}/new`)}
        >
          <Icon as={Plus} size={24} className="text-foreground" />
        </Pressable>
      </View>

      <MonthStepper month={month} onChange={(next) => router.setParams({ month: next })} />

      {calendar.isPending ? (
        <CalendarSkeleton />
      ) : calendar.data === undefined ? (
        <EmptyState
          icon={WifiOff}
          title="출금 일정을 불러오지 못했어요"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onPress: () => calendar.refetch(), disabled: calendar.isFetching }}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.date}
          contentContainerClassName="gap-5 px-6 pb-8"
          refreshing={calendar.isRefetching}
          onRefresh={() => calendar.refetch()}
          ListHeaderComponent={<CalendarSummary count={calendar.data.entries.length} shortageCount={calendar.data.shortageCount} />}
          ListEmptyComponent={
            <EmptyState icon={CalendarDays} title={CALENDAR_EMPTY_MESSAGE} description="고정지출을 등록하면 출금 예정일이 여기에 보여요." />
          }
          renderItem={({ item }) => (
            <DayGroup
              group={item}
              onSelect={(entry) =>
                entry.fixedExpenseId === null ? undefined : router.push(`${FIXED_EXPENSE_ROUTE}/${entry.fixedExpenseId}`)
              }
            />
          )}
        />
      )}
    </View>
  );
}

type MonthStepperProps = {
  month: string;
  onChange: (month: string) => void;
};

// 거래 내역(PAGE-11 전체보기)과 같은 월 스테퍼. 앞으로 나갈 출금이라 다음 달로도 넘어간다.
function MonthStepper({ month, onChange }: MonthStepperProps) {
  return (
    <View className="flex-row items-center justify-center gap-4 pb-3">
      <Pressable accessibilityRole="button" accessibilityLabel="이전 달" hitSlop={12} onPress={() => onChange(shiftMonthKey(month, -1))}>
        <Icon as={ChevronLeft} size={20} className="text-foreground" />
      </Pressable>
      <Text className="text-h3 tabular-nums text-foreground" accessibilityLiveRegion="polite">
        {formatMonthKeyLabel(month)}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="다음 달" hitSlop={12} onPress={() => onChange(shiftMonthKey(month, 1))}>
        <Icon as={ChevronRight} size={20} className="text-foreground" />
      </Pressable>
    </View>
  );
}

type CalendarSummaryProps = {
  count: number;
  shortageCount: number;
};

function CalendarSummary({ count, shortageCount }: CalendarSummaryProps) {
  if (count === 0) return null;

  return (
    <View className="flex-row items-center justify-between pb-1" accessibilityLiveRegion="polite">
      <Text className="text-body-sm text-card-foreground">출금 예정 {count}건</Text>
      {shortageCount > 0 ? (
        <Text className="text-body-sm tabular-nums text-destructive">준비 부족 {shortageCount}건</Text>
      ) : (
        <Text className="text-body-sm text-positive">모두 준비됐어요</Text>
      )}
    </View>
  );
}

type DayGroupProps = {
  group: CalendarDayGroup;
  onSelect: (entry: CalendarEntry) => void;
};

function DayGroup({ group, onSelect }: DayGroupProps) {
  return (
    <View className="gap-2">
      <Text className="text-label text-card-foreground">{formatMonthDay(parseKSTDateKey(group.date))}</Text>
      <View className="gap-2">
        {group.entries.map((entry) => (
          <EntryCard key={entry.key} entry={entry} onPress={() => onSelect(entry)} />
        ))}
      </View>
    </View>
  );
}

type EntryCardProps = {
  entry: CalendarEntry;
  onPress: () => void;
};

// 고정지출만 수정할 수 있다. 카드 청구는 서버가 만든 예정이라 눌러도 갈 곳이 없어 버튼으로 두지 않는다.
function EntryCard({ entry, onPress }: EntryCardProps) {
  const editable = entry.fixedExpenseId !== null;
  const name = entry.estimated ? `${entry.name} ${ESTIMATED_SUFFIX}` : entry.name;
  const badge = entry.prepared ? PREPARED_LABEL : `부족 ${formatKRW(entry.shortage)}`;
  const label = `${name} ${formatKRW(entry.amount)}, ${badge}`;

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-2xl bg-card p-4 shadow-sm shadow-black/5 active:opacity-70 dark:border dark:border-border dark:shadow-none"
      accessible
      accessibilityRole={editable ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityHint={editable ? "고정지출을 수정합니다" : undefined}
      disabled={!editable}
      onPress={onPress}
    >
      <View className="flex-1 gap-1">
        <Text className="text-h3 text-foreground" numberOfLines={1}>
          {name}
        </Text>
        <View className={cn("self-start rounded-sm px-1.5 py-0.5", entry.prepared ? "bg-positive-muted" : "bg-destructive-muted")}>
          <Text className={cn("text-caption tabular-nums", entry.prepared ? "text-positive" : "text-destructive")}>{badge}</Text>
        </View>
      </View>
      <Text className="text-amount-sm tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
        {formatKRW(entry.amount)}
      </Text>
      {editable ? <Icon as={ChevronRight} size={18} className="text-card-foreground" /> : null}
    </Pressable>
  );
}

const SKELETON_ROWS = [1, 2, 3];

function CalendarSkeleton() {
  return (
    <View className="gap-3 px-6 pt-2" accessible accessibilityLabel="불러오는 중">
      {SKELETON_ROWS.map((row) => (
        <Skeleton key={row} className="h-20 w-full rounded-2xl" />
      ))}
    </View>
  );
}

export { PaymentCalendarScreen };
