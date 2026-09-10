import { useRouter } from "expo-router";
import { ChevronLeft, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Text } from "@/components/ui/text";
import { useBudgetProposal, useConfirmBudget } from "@/features/budget/api/queries";
import { envelopeIcon } from "@/features/budget/catalog";
import { sumAmounts, type BudgetProposal, type BudgetProposalEnvelope } from "@/features/budget/model";
import { currentMonthKey, formatMonthKeyLabel } from "@/lib/date";
import { formatKRW, fromWon, toWon, type KRW } from "@/lib/money";

/** 슬라이더 범위. 명세에 상한이 없어 시안 기준 15만원·1천원 단위로 두고, 제안액이 더 크면 그만큼 늘린다. (TBD) */
const SLIDER_BASE_MAX = 150000;
const SLIDER_STEP = 1000;

const CTA_LABEL = "이 예산으로 시작하기";

/** 승인 뒤에는 입주 연출(PAGE-08)을 거쳐 홈으로 간다 (유저 플로우 v2 온보딩 레인) */
const MOVING_IN_ROUTE = "/character/moving-in";

/** 하단 CTA 가 안전 영역이 없는 기기에서도 탭바처럼 띄워지는 최소 여백 (components/ui/tab-bar.tsx 와 같은 기준) */
const MIN_BOTTOM_INSET = 12;

// Pencil budget-proposal (g1fhiV) · budget-proposal/full (VAJgp). 온보딩 화면이라 탭바가 없고 CTA 가 하단에 고정된다.
function BudgetProposalScreen() {
  const month = currentMonthKey();
  const proposal = useBudgetProposal(month);

  return (
    <View className="flex-1 bg-background">
      <ProposalHeader />
      {proposal.isPending ? (
        <ProposalSkeleton />
      ) : proposal.isError ? (
        <EmptyState
          icon={WifiOff}
          title="예산 제안을 불러오지 못했어요"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onPress: () => proposal.refetch(), disabled: proposal.isFetching }}
        />
      ) : (
        <ProposalForm proposal={proposal.data} month={month} />
      )}
    </View>
  );
}

// Pencil Header (wwtVz): bg-card · 뒤로가기 + 제목. 안전 영역 상단은 라우트의 SafeAreaView 가 맡는다.
function ProposalHeader() {
  const router = useRouter();

  return (
    <View className="flex-row items-center gap-3 bg-card px-6 pb-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        hitSlop={10}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/budget"))}
      >
        <Icon as={ChevronLeft} size={24} className="text-foreground" />
      </Pressable>
      <Text className="text-h3 text-foreground" accessibilityRole="header">
        예산 설정
      </Text>
    </View>
  );
}

type ProposalFormProps = {
  proposal: BudgetProposal;
  month: string;
};

function ProposalForm({ proposal, month }: ProposalFormProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirmBudget();

  // 제안액이 기본값이고, 사용자가 만진 봉투만 덮어쓴다.
  const proposed = React.useMemo(
    () => Object.fromEntries(proposal.envelopes.map((envelope) => [envelope.envelopeId, envelope.proposed])),
    [proposal.envelopes]
  ) as Record<number, KRW>;
  const [edited, setEdited] = React.useState<Record<number, KRW>>({});
  const amountOf = (envelopeId: number): KRW => edited[envelopeId] ?? proposed[envelopeId];

  const total = sumAmounts(proposal.envelopes.map((envelope) => amountOf(envelope.envelopeId)));
  const monthlyAvgTotal = sumAmounts(proposal.envelopes.map((envelope) => envelope.monthlyAvg));

  const handleConfirm = () => {
    const entries = proposal.envelopes.map((envelope) => ({
      envelopeId: envelope.envelopeId,
      amount: amountOf(envelope.envelopeId),
    }));
    confirm.mutate({ month, entries }, { onSuccess: () => router.replace(MOVING_IN_ROUTE) });
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="gap-5 px-6 pt-5 pb-6">
        <View className="gap-1.5">
          <Text className="text-h1 text-foreground" accessibilityRole="header">
            이번 달 예산을 정해요
          </Text>
          <Text className="text-body-sm text-muted-foreground">
            지난 3개월 소비를 분석해 봉투별 금액을 제안했어요. 필요하면 바꿀 수 있어요.
          </Text>
        </View>

        <View className="gap-1 rounded-2xl bg-card p-5 shadow-sm shadow-black/5 dark:border dark:border-border dark:shadow-none">
          <Text className="text-caption text-muted-foreground">{formatMonthKeyLabel(month)} 총 예산</Text>
          <Text className="text-amount-md tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
            {formatKRW(total)}
          </Text>
          <Text className="text-caption tabular-nums text-muted-foreground">
            봉투 {proposal.envelopes.length}개 · 지난 3개월 월평균 {formatKRW(monthlyAvgTotal)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-h3 text-foreground" accessibilityRole="header">
            봉투별 금액
          </Text>
          <Text className="text-caption tabular-nums text-muted-foreground">{proposal.envelopes.length}개</Text>
        </View>

        <View className="gap-3.5">
          {proposal.envelopes.map((envelope) => (
            <EnvelopeAmountRow
              key={envelope.envelopeId}
              envelope={envelope}
              amount={amountOf(envelope.envelopeId)}
              onChange={(next) => setEdited((prev) => ({ ...prev, [envelope.envelopeId]: next }))}
            />
          ))}
        </View>
      </ScrollView>

      <View className="gap-2 px-6 pt-3" style={{ paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) }}>
        {confirm.isError ? (
          <Text className="text-caption text-destructive" accessibilityLiveRegion="polite">
            예산을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.
          </Text>
        ) : null}
        <Button
          size="lg"
          className="h-button-lg rounded-lg"
          onPress={handleConfirm}
          disabled={confirm.isPending}
          accessibilityLabel={CTA_LABEL}
        >
          <Text>{confirm.isPending ? "저장하는 중…" : CTA_LABEL}</Text>
        </Button>
      </View>
    </View>
  );
}

type EnvelopeAmountRowProps = {
  envelope: BudgetProposalEnvelope;
  amount: KRW;
  onChange: (amount: KRW) => void;
};

// Pencil 행(I3tEno): 28pt accent 타일 + 이름 / 우측 금액칸 · 슬라이더 · 월평균 근거.
function EnvelopeAmountRow({ envelope, amount, onChange }: EnvelopeAmountRowProps) {
  const current = Number(toWon(amount));
  const max = Math.max(SLIDER_BASE_MAX, Math.ceil(Number(toWon(envelope.proposed)) / SLIDER_STEP) * SLIDER_STEP);

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-7 w-7 items-center justify-center rounded-md bg-accent">
            <Icon as={envelopeIcon(envelope.envelopeId)} size={16} className="text-primary" />
          </View>
          <Text className="text-label text-foreground">{envelope.name}</Text>
        </View>
        <View className="rounded-md bg-muted px-3 py-1.5">
          <Text className="text-amount-sm tabular-nums text-foreground">{formatKRW(amount, { unit: false })}</Text>
        </View>
      </View>
      <Slider
        value={current}
        max={max}
        step={SLIDER_STEP}
        onValueChange={(next) => onChange(fromWon(BigInt(next)))}
        accessibilityLabel={`${envelope.name} 금액`}
      />
      <Text className="text-caption tabular-nums text-muted-foreground">월평균 {formatKRW(envelope.monthlyAvg)}</Text>
    </View>
  );
}

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7];

function ProposalSkeleton() {
  return (
    <View className="gap-5 px-6 pt-5" accessible accessibilityLabel="불러오는 중">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <View className="gap-3.5">
        {SKELETON_ROWS.map((row) => (
          <View key={row} className="gap-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-5 w-full rounded-full" />
          </View>
        ))}
      </View>
    </View>
  );
}

export { BudgetProposalScreen, CTA_LABEL };
