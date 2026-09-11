import { useRouter } from "expo-router";
import { Circle, CircleDot, WalletMinimal } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useSetIncomeAccount } from "@/features/account/api/queries";
import { incomeAccountErrorMessage } from "@/features/account/errors";
import { canSubmitIncomeAccount, toIncomeAccountOptions, type IncomeAccountOption } from "@/features/account/model";
import { useLinkCandidates } from "@/features/link/api/queries";
import { BankLogoTile } from "@/features/link/components/BankLogoTile";
import { CandidatesErrorState } from "@/features/link/components/CandidatesErrorState";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/** 다음은 소비 분석(PAGE-06 분석 중) */
const NEXT_ROUTE = "/onboarding/spending-analysis";

const ASSET_SELECT_ROUTE = "/onboarding/asset-select";

/** 하단 CTA 가 안전 영역이 없는 기기에서도 띄워지는 최소 여백 (AssetSelectScreen 과 같은 기준) */
const MIN_BOTTOM_INSET = 12;

// PAGE-05 수입 계좌 지정. Pencil 시안이 없어 계좌·카드 연결(PAGE-04)의 구성과 행 모양을 따른다.
// 목록은 GET /accounts 대신 금융망 후보 중 연결된 계좌로 만든다 — ACCOUNT 명세 미완성 (docs/api-contract.md ACCOUNT).
function IncomeAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const candidates = useLinkCandidates();
  const setIncomeAccount = useSetIncomeAccount();

  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const options = candidates.data === undefined ? [] : toIncomeAccountOptions(candidates.data);
  const canSubmit = canSubmitIncomeAccount(options, selectedId) && !setIncomeAccount.isPending;
  const errorMessage = setIncomeAccount.isError ? incomeAccountErrorMessage(setIncomeAccount.error) : null;

  const handleSubmit = () => {
    if (!canSubmit || selectedId === null) return;
    setIncomeAccount.mutate(selectedId, { onSuccess: () => router.replace(NEXT_ROUTE) });
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 gap-5 px-6 pt-6">
        <View className="gap-1.5">
          <Text className="text-h2 text-foreground" accessibilityRole="header">
            수입이 들어오는 계좌를 골라 주세요
          </Text>
          <Text className="text-body-sm text-muted-foreground">급여·용돈처럼 돈이 들어오는 계좌 1개를 지정해요.</Text>
        </View>

        {candidates.isPending ? (
          <OptionsSkeleton />
        ) : candidates.isError ? (
          <View className="flex-1 justify-center pb-20">
            <CandidatesErrorState
              error={candidates.error}
              retrying={candidates.isFetching}
              onRetry={() => candidates.refetch()}
            />
          </View>
        ) : options.length === 0 ? (
          <View className="flex-1 justify-center pb-20">
            <EmptyState
              icon={WalletMinimal}
              title="연결된 계좌가 없어요"
              description="수입 계좌로 지정하려면 계좌를 먼저 연결해 주세요."
              action={{ label: "계좌 연결하기", onPress: () => router.replace(ASSET_SELECT_ROUTE) }}
            />
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="gap-2.5 pb-6" accessibilityRole="radiogroup">
            {options.map((option) => (
              <IncomeAccountRow
                key={option.accountId}
                option={option}
                selected={option.accountId === selectedId}
                disabled={setIncomeAccount.isPending}
                onSelect={() => setSelectedId(option.accountId)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View className="gap-2 px-6 pt-3" style={{ paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) }}>
        {errorMessage === null ? null : (
          <Text className="text-caption text-destructive" accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        )}
        <Button size="lg" className="h-button-lg rounded-lg" onPress={handleSubmit} disabled={!canSubmit}>
          <Text>{setIncomeAccount.isPending ? "지정하는 중…" : "다음"}</Text>
        </Button>
      </View>
    </View>
  );
}

type IncomeAccountRowProps = {
  option: IncomeAccountOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

// PAGE-04 행과 같은 모양(표시 + 36 로고 타일 + 이름/마스킹 번호 + 잔액)에 체크 대신 라디오를 둔다.
function IncomeAccountRow({ option, selected, disabled, onSelect }: IncomeAccountRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${option.bankName} ${option.maskedNo}`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onSelect}
      className={cn(
        "flex-row items-center gap-3 rounded-lg border bg-card px-4 py-3.5",
        selected ? "border-primary" : "border-border"
      )}
    >
      <Icon
        as={selected ? CircleDot : Circle}
        size={20}
        className={selected ? "text-primary" : "text-muted-foreground"}
      />

      <BankLogoTile bankCode={option.bankCode} name={option.bankName} />

      <View className="flex-1 gap-0.5">
        <Text className="text-label text-foreground" numberOfLines={1}>
          {option.bankName}
        </Text>
        <Text className="text-caption tabular-nums text-muted-foreground" numberOfLines={1}>
          {option.maskedNo}
        </Text>
      </View>

      <Text className="text-amount-sm tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
        {formatKRW(option.balance)}
      </Text>
    </Pressable>
  );
}

const SKELETON_ROWS = [1, 2];

function OptionsSkeleton() {
  return (
    <View className="gap-2.5" accessible accessibilityLabel="불러오는 중">
      {SKELETON_ROWS.map((row) => (
        <Skeleton key={row} className="h-16 w-full rounded-lg" />
      ))}
    </View>
  );
}

export { IncomeAccountScreen };
