import type { UseQueryResult } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { Menu, WalletMinimal, WifiOff } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useCurrentBudget } from "@/features/budget/api/queries";
import { envelopeIcon, envelopeTone } from "@/features/budget/catalog";
import { PROPOSAL_FROM_HOME_HREF } from "@/features/budget/components/BudgetProposalScreen";
import {
  budgetHealth,
  budgetPeriodLabel,
  envelopeHealth,
  usedBarPercent,
  type Budget,
  type BudgetEnvelope,
  type BudgetHealth,
  type BudgetTotal,
  type EnvelopeHealth,
} from "@/features/budget/model";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/** 봉투 행 탭 → 봉투 상세(PAGE-23) */
const ENVELOPE_DETAIL_ROUTE = "/budget";

// Pencil budget (kvc1e). 확정 전(PROPOSED) 주기는 이 탭 대신 예산 확정 화면으로 보낸다(노션 예산·잔액 조회, 사용자 결정 2026-09-12).
function BudgetScreen() {
  const budget = useCurrentBudget();

  if (budget.data?.status === "PROPOSED") return <Redirect href={PROPOSAL_FROM_HOME_HREF} />;

  return (
    <View className="flex-1 bg-background">
      <BudgetHeader />
      <BudgetContent budget={budget} />
    </View>
  );
}

// Pencil Header (V1nCzt): bg-card · 하단 보더 · 아래 방향 그림자 · padding [59,24,12,24] (상단 59 는 안전 영역).
function BudgetHeader() {
  return (
    <View className="flex-row items-center justify-between border-b border-border bg-card px-6 pb-3 shadow-sm shadow-black/5 dark:shadow-none">
      <Text className="text-h1 text-foreground" accessibilityRole="header">
        예산관리
      </Text>
      <MenuButton />
    </View>
  );
}

// Pencil Menu (CrnXH). 햄버거를 눌렀을 때의 동작이 명세에 없어 자리만 두고 비활성으로 둔다. (TBD)
function MenuButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="메뉴" accessibilityState={{ disabled: true }} disabled hitSlop={10}>
      <Icon as={Menu} size={24} className="text-foreground" />
    </Pressable>
  );
}

type BudgetContentProps = {
  budget: UseQueryResult<Budget>;
};

// Pencil Content (U133b / AptUM): 좌우 여백 24 · 블록 간격 20.
function BudgetContent({ budget }: BudgetContentProps) {
  const router = useRouter();

  if (budget.isPending) return <BudgetSkeleton />;
  if (budget.isError) {
    return (
      <EmptyState
        icon={WifiOff}
        title="예산을 불러오지 못했어요"
        description="연결 상태를 확인한 뒤 다시 시도해 주세요."
        action={{ label: "다시 시도", onPress: () => budget.refetch(), disabled: budget.isFetching }}
      />
    );
  }

  const { total, envelopes } = budget.data;

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 pb-6">
      {total === null ? null : <TotalCard total={total} period={budgetPeriodLabel(budget.data)} />}
      <SectionTitle heading="봉투별 잔액" count={envelopes.length} />
      {envelopes.length === 0 ? (
        <EmptyState icon={WalletMinimal} title="봉투가 아직 없어요" description="예산이 만들어지면 봉투 7종이 여기에 보여요." />
      ) : (
        <View className="gap-4">
          {envelopes.map((envelope) => (
            <EnvelopeRow
              key={envelope.envelopeId}
              envelope={envelope}
              onPress={() => router.push(`${ENVELOPE_DETAIL_ROUTE}/${envelope.envelopeId}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// Pencil TotalCard (aAfOZ) 의 Used 막대는 $primary 한 가지뿐이라 경고·초과 색은 홈 BudgetCard 와 같은 기준으로 맞췄다.
const TOTAL_BAR_CLASS: Record<BudgetHealth, string> = {
  good: "bg-primary",
  warning: "bg-warning",
  over: "bg-destructive",
};

type TotalCardProps = {
  total: BudgetTotal;
  /** 현재 주기 "9월 1일~30일" */
  period: string;
};

// Pencil 예산 탭 · 카드 정리 대안 (IiOk3) 의 TotalCard: 카드 없이 라벨 · 금액 · 진행 바 8pt · 총/사용이 본문에 바로.
function TotalCard({ total, period }: TotalCardProps) {
  const health = budgetHealth(total);
  const used = usedBarPercent(total.remainingRate);

  return (
    <View className="gap-3 pb-1 pt-5">
      <Text className="text-label tabular-nums text-card-foreground">{period} 남은 예산</Text>
      <Text className={cn("text-amount-lg tabular-nums", health === "over" ? "text-destructive" : "text-foreground")} maxFontSizeMultiplier={1.3}>
        {formatKRW(total.remaining)}
      </Text>
      <View
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="예산 사용률"
        accessibilityValue={{ min: 0, max: 100, now: used }}
      >
        <View className={cn("h-full rounded-full", TOTAL_BAR_CLASS[health])} style={{ width: `${used}%` }} />
      </View>
      <View className="flex-row justify-between">
        <Text className="text-caption tabular-nums text-card-foreground">총 {formatKRW(total.confirmed)}</Text>
        <Text className="text-caption tabular-nums text-card-foreground">사용 {formatKRW(total.spent)}</Text>
      </View>
    </View>
  );
}

type SectionTitleProps = {
  heading: string;
  count: number;
};

// Pencil SectionTitle (XcJHm / Ce47c)
function SectionTitle({ heading, count }: SectionTitleProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-h3 text-foreground" accessibilityRole="header">
        {heading}
      </Text>
      <Text className="text-caption tabular-nums text-card-foreground">{count}개</Text>
    </View>
  );
}

const ENVELOPE_BAR_CLASS: Record<EnvelopeHealth, string> = {
  good: "bg-positive",
  warning: "bg-warning",
  over: "bg-destructive",
  unset: "bg-muted",
};

// Pencil EnvelopeList (MhHC7 / uPyCM) 의 행: 28pt accent 타일 + 아이콘 16 · 이름 14/500 · 금액 16/600 · 사용률 바 6pt.
// 확정액 0 인 봉투는 잔여율이 없어 빈 트랙이고, 쓴 돈이 있으면 over 색으로 초과 금액을 적는다(사용자 결정 2026-09-12).
function EnvelopeRow({ envelope, onPress }: { envelope: BudgetEnvelope; onPress: () => void }) {
  const health = envelopeHealth(envelope);
  const used = usedBarPercent(envelope.remainingRate);
  const amountText = envelopeAmountText(envelope, health);

  return (
    <Pressable
      className="gap-2 active:opacity-70"
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${envelope.name} ${amountText}`}
      accessibilityHint="봉투 상세를 엽니다"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className={cn("h-7 w-7 items-center justify-center rounded-md", envelopeTone(envelope.envelopeId).tile)}>
            <Icon as={envelopeIcon(envelope.envelopeId)} size={16} className={envelopeTone(envelope.envelopeId).icon} />
          </View>
          <Text className="text-label text-foreground">{envelope.name}</Text>
        </View>
        <Text
          className={cn(
            "text-amount-sm tabular-nums",
            health === "over" ? "text-destructive" : health === "unset" ? "text-card-foreground" : "text-foreground"
          )}
        >
          {amountText}
        </Text>
      </View>
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <View className={cn("h-full rounded-full", ENVELOPE_BAR_CLASS[health])} style={{ width: `${used}%` }} />
      </View>
    </Pressable>
  );
}

function envelopeAmountText(envelope: BudgetEnvelope, health: EnvelopeHealth): string {
  if (health === "unset" || envelope.remaining === null) return envelope.proposed === null ? "-" : `제안 ${formatKRW(envelope.proposed)}`;
  if (health === "over") return `${formatKRW(envelope.remaining, { sign: "never" })} 초과`;
  return `${formatKRW(envelope.remaining)} 남음`;
}

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7];

function BudgetSkeleton() {
  return (
    <View className="gap-5 px-6 pt-5" accessible accessibilityLabel="불러오는 중">
      <View className="gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-11 w-48" />
        <Skeleton className="h-2 w-full rounded-full" />
      </View>
      <Skeleton className="h-6 w-24" />
      <View className="gap-4">
        {SKELETON_ROWS.map((row) => (
          <View key={row} className="gap-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </View>
        ))}
      </View>
    </View>
  );
}

export { BudgetScreen };
