import { useRouter } from "expo-router";
import { ChevronLeft, Circle, CircleCheckBig, WalletMinimal } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useCreateLinks, useLinkCandidates } from "@/features/link/api/queries";
import { BankLogoTile } from "@/features/link/components/BankLogoTile";
import { CandidatesErrorState } from "@/features/link/components/CandidatesErrorState";
import { linkErrorMessage } from "@/features/link/errors";
import {
  areAllLinksSelected,
  canSubmitLinks,
  countLinkRequest,
  hasNoLinkCandidates,
  isLinkSelectable,
  toggleLinkSelection,
  toggleSelectAllLinks,
  toLinkRequest,
  type LinkAccount,
  type LinkCandidates,
  type LinkCard,
} from "@/features/link/model";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/** 다음은 수입 계좌 지정(PAGE-05) */
const NEXT_ROUTE = "/onboarding/income-account";

/** 하단 CTA 가 안전 영역이 없는 기기에서도 띄워지는 최소 여백 (BudgetProposalScreen 과 같은 기준) */
const MIN_BOTTOM_INSET = 12;

const EMPTY_CANDIDATES: LinkCandidates = { accounts: [], cards: [] };

// Pencil asset-select (WVh9e) · loading (WjG6u) · empty (V4e93x) · error (U9gpA).
// 온보딩 화면이라 탭바가 없고 CTA 가 하단에 고정된다.
function AssetSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const candidates = useLinkCandidates();
  const createLinks = useCreateLinks();

  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());

  const data = candidates.data ?? EMPTY_CANDIDATES;
  const request = toLinkRequest(data, selected);
  const count = countLinkRequest(request);
  const canSubmit = canSubmitLinks(request) && !createLinks.isPending;
  const ctaLabel = count > 0 ? `${count}개 연결하기` : "연결하기";
  const errorMessage = createLinks.isError ? linkErrorMessage(createLinks.error) : null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createLinks.mutate(request, { onSuccess: () => router.replace(NEXT_ROUTE) });
  };

  return (
    <View className="flex-1 bg-background">
      <AssetSelectHeader
        allSelected={areAllLinksSelected(data, selected)}
        disabled={candidates.data === undefined || hasNoLinkCandidates(data)}
        onToggleAll={() => setSelected((prev) => toggleSelectAllLinks(data, prev))}
      />

      <View className="flex-1 gap-5 px-6 pt-2">
        <View className="gap-1.5">
          <Text className="text-h2 text-foreground" accessibilityRole="header">
            연결할 자산을 선택해 주세요
          </Text>
          <Text className="text-body-sm text-muted-foreground">선택한 계좌와 카드의 거래만 불러옵니다.</Text>
        </View>

        {candidates.isPending ? (
          <CandidatesSkeleton />
        ) : candidates.isError ? (
          <View className="flex-1 justify-center pb-20">
            <CandidatesErrorState
              error={candidates.error}
              retrying={candidates.isFetching}
              onRetry={() => candidates.refetch()}
            />
          </View>
        ) : hasNoLinkCandidates(data) ? (
          <View className="flex-1 justify-center pb-20">
            <EmptyState
              icon={WalletMinimal}
              title="연결할 자산이 없어요"
              description="금융망에 등록된 계좌·카드가 없습니다. 금융망에서 먼저 등록해 주세요."
            />
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="gap-5 pb-6">
            {data.accounts.length > 0 ? (
              <LinkSection title="계좌" count={data.accounts.length}>
                {data.accounts.map((account) => (
                  <AccountRow
                    key={account.finAccountNo}
                    account={account}
                    selected={selected.has(account.finAccountNo)}
                    onToggle={() => setSelected((prev) => toggleLinkSelection(prev, account.finAccountNo))}
                  />
                ))}
              </LinkSection>
            ) : null}

            {data.cards.length > 0 ? (
              <LinkSection title="카드" count={data.cards.length}>
                {data.cards.map((card) => (
                  <CardRow
                    key={card.cardNo}
                    card={card}
                    selected={selected.has(card.cardNo)}
                    onToggle={() => setSelected((prev) => toggleLinkSelection(prev, card.cardNo))}
                  />
                ))}
              </LinkSection>
            ) : null}
          </ScrollView>
        )}
      </View>

      <View className="gap-2 px-6 pt-3" style={{ paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) }}>
        {errorMessage === null ? null : (
          <Text className="text-caption text-destructive" accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        )}
        <Button
          size="lg"
          className="h-button-lg rounded-lg"
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityLabel={ctaLabel}
        >
          <Text>{createLinks.isPending ? "연결하는 중…" : ctaLabel}</Text>
        </Button>
      </View>
    </View>
  );
}

type AssetSelectHeaderProps = {
  allSelected: boolean;
  disabled: boolean;
  onToggleAll: () => void;
};

// Pencil Header (mhmSI): 뒤로가기 + '내 자산' + 우측 '전체 선택'. 안전 영역 상단은 라우트의 SafeAreaView 가 맡는다.
function AssetSelectHeader({ allSelected, disabled, onToggleAll }: AssetSelectHeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between px-6 pb-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={10}
          onPress={() => router.canGoBack() && router.back()}
        >
          <Icon as={ChevronLeft} size={24} className="text-foreground" />
        </Pressable>
        <Text className="text-h3 text-foreground" accessibilityRole="header">
          내 자산
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={allSelected ? "전체 해제" : "전체 선택"}
        accessibilityState={{ disabled }}
        hitSlop={10}
        disabled={disabled}
        onPress={onToggleAll}
      >
        <Text className={cn("text-label", disabled ? "text-muted-foreground" : "text-primary")}>
          {allSelected ? "전체 해제" : "전체 선택"}
        </Text>
      </Pressable>
    </View>
  );
}

type LinkSectionProps = {
  title: string;
  count: number;
  children: React.ReactNode;
};

function LinkSection({ title, count, children }: LinkSectionProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-h3 text-foreground" accessibilityRole="header">
          {title}
        </Text>
        <Text className="text-caption tabular-nums text-muted-foreground">{count}개</Text>
      </View>
      <View className="gap-2.5">{children}</View>
    </View>
  );
}

type AccountRowProps = {
  account: LinkAccount;
  selected: boolean;
  onToggle: () => void;
};

function AccountRow({ account, selected, onToggle }: AccountRowProps) {
  return (
    <LinkRow
      logo={<BankLogoTile bankCode={account.bankCode} name={account.bankName} />}
      title={account.bankName}
      subtitle={account.maskedNo}
      linked={!isLinkSelectable(account)}
      selected={selected}
      onToggle={onToggle}
      right={
        <Text className="text-amount-sm tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
          {formatKRW(account.balance)}
        </Text>
      }
    />
  );
}

type CardRowProps = {
  card: LinkCard;
  selected: boolean;
  onToggle: () => void;
};

// 출금 계좌는 시안(14/600)보다 작은 text-caption 으로 둔다 — 실제 마스킹 번호가 시안 예시보다 길어
// 14 로는 카드 이름이 잘린다.
function CardRow({ card, selected, onToggle }: CardRowProps) {
  return (
    <LinkRow
      logo={<BankLogoTile name={card.issuerName} />}
      title={card.cardName}
      subtitle={card.maskedNo}
      linked={!isLinkSelectable(card)}
      selected={selected}
      onToggle={onToggle}
      right={
        <Text className="text-caption tabular-nums text-muted-foreground">출금 {card.maskedWithdrawalNo}</Text>
      }
    />
  );
}

type LinkRowProps = {
  logo: React.ReactNode;
  title: string;
  subtitle: string;
  right: React.ReactNode;
  linked: boolean;
  selected: boolean;
  onToggle: () => void;
};

// Pencil 행(Lb1GR · a9XLX9 · n4oRz7): 체크 + 36 로고 타일 + 이름/마스킹 번호 + 우측 값.
// 이미 연결된 행은 bg-muted 로 잠기고 '연결됨'만 보여 준다.
function LinkRow({ logo, title, subtitle, right, linked, selected, onToggle }: LinkRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${title} ${subtitle}`}
      accessibilityState={{ checked: selected, disabled: linked }}
      disabled={linked}
      onPress={onToggle}
      className={cn(
        "flex-row items-center gap-3 rounded-lg border px-4 py-3.5",
        linked ? "border-border bg-muted" : selected ? "border-primary bg-card" : "border-border bg-card"
      )}
    >
      <Icon
        as={selected ? CircleCheckBig : Circle}
        size={20}
        className={selected ? "text-primary" : "text-muted-foreground"}
      />

      {logo}

      <View className="flex-1 gap-0.5">
        <Text className={cn("text-label", linked ? "text-muted-foreground" : "text-foreground")} numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-caption tabular-nums text-muted-foreground" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {linked ? <Text className="text-caption text-muted-foreground">연결됨</Text> : right}
    </Pressable>
  );
}

const SKELETON_ROWS = [1, 2, 3];

function CandidatesSkeleton() {
  return (
    <View className="gap-2.5" accessible accessibilityLabel="불러오는 중">
      <Skeleton className="h-5 w-16 rounded-md" />
      {SKELETON_ROWS.map((row) => (
        <Skeleton key={row} className="h-16 w-full rounded-lg" />
      ))}
    </View>
  );
}

export { AssetSelectScreen };
