import type { UseQueryResult } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { WalletMinimal, WifiOff } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { CountUpAmount } from "@/components/ui/count-up-amount";
import { FillBar } from "@/components/ui/fill-bar";
import { Screen, ScreenScrollView, useHeaderlessTop } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { needsConfirmation, useCurrentBudget } from "@/features/budget/api/queries";
import { EnvelopeCarousel } from "@/features/budget/components/EnvelopeCarousel";
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
const FROM_ENVELOPE = "envelope";

// Pencil budget (kvc1e). 확정 전(PROPOSED) 주기는 이 탭 대신 예산 확정 화면으로 보낸다(노션 예산·잔액 조회, 사용자 결정 2026-09-12).
function BudgetScreen() {
  const budget = useCurrentBudget();
  const topInset = useHeaderlessTop();

  if (needsConfirmation(budget)) return <Redirect href={PROPOSAL_FROM_HOME_HREF} />;

  return (
    <Screen>
      <View className="flex-1" style={{ paddingTop: topInset }}>
        <BudgetContent budget={budget} />
      </View>
    </Screen>
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
    <ScreenScrollView className="flex-1" contentContainerClassName="flex-grow gap-10 px-6">
      {total === null ? null : <TotalCard total={total} period={budgetPeriodLabel(budget.data)} />}
      {/* 회전판은 하단 탭 바로 위에 붙는다(사용자 결정 2026-09-18) — 남는 높이를 위로 몰아 아래로 내린다. */}
      <View className="mt-auto gap-4">
        <SectionTitle heading="봉투별 잔액" count={envelopes.length} />
        {envelopes.length === 0 ? (
          <EmptyState icon={WalletMinimal} title="봉투가 아직 없어요" description="예산이 만들어지면 봉투 7종이 여기에 보여요." />
        ) : (
          // 좌우로 돌리는 원판이라 화면 폭을 다 써야 옆 카드가 끝에 걸쳐 보인다 — 본문 좌우 여백을 상쇄한다.
          <View className="-mx-6">
            <EnvelopeCarousel
              envelopes={envelopes}
              // 봉투가 펼쳐져 화면을 덮은 뒤 넘어가므로 스택 전환 애니메이션은 끈다(from=envelope)
              onSelect={(envelopeId) => router.push(`${ENVELOPE_DETAIL_ROUTE}/${envelopeId}?from=${FROM_ENVELOPE}`)}
            />
          </View>
        )}
      </View>
    </ScreenScrollView>
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

// Pencil PAGE-12 예산 탭 (kvc1e) 의 TotalCard: 흰 카드 안에 라벨 · 금액 · 진행 바 8pt · 총/사용 (2026-09-17 사용자 결정 — IiOk3 의 카드 없는 안에서 되돌림).
// 면 구분은 카드 규칙대로 테두리 대신 그림자(다크는 테두리).
function TotalCard({ total, period }: TotalCardProps) {
  const health = budgetHealth(total);
  const used = usedBarPercent(total.remainingRate);

  return (
    <View className="gap-3 rounded-2xl bg-card p-5 shadow shadow-black/10 dark:border dark:border-border dark:shadow-none">
      <Text className="text-label tabular-nums text-card-foreground">{period} 남은 예산</Text>
      <CountUpAmount
        value={total.remaining}
        className={cn("text-amount-lg tabular-nums", health === "over" ? "text-destructive" : "text-foreground")}
      />
      <FillBar
        percent={used}
        fillClassName={TOTAL_BAR_CLASS[health]}
        fillDelay={0}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="예산 사용률"
        accessibilityValue={{ min: 0, max: 100, now: used }}
      />
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

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7];

function BudgetSkeleton() {
  return (
    <View className="gap-5 px-6" accessible accessibilityLabel="불러오는 중">
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
