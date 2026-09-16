import { useRouter } from "expo-router";
import { CheckCheck, CircleAlert, WifiOff } from "lucide-react-native";
import { useState } from "react";
import { FlatList, View } from "react-native";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { flattenPending, useClassifyTransaction, usePendingTransactions, useSubcategories } from "@/features/transaction/api/queries";
import { SubcategorySheet } from "@/features/transaction/components/SubcategorySheet";
import { classifyErrorMessage } from "@/features/transaction/errors";
import { merchantLabel, transactionDateTimeLabel, type ClassifyRequest, type Transaction } from "@/features/transaction/model";
import { formatKRW, subtractKRW } from "@/lib/money";

const HOME_ROUTE = "/";
const OTHER_CATEGORY_LABEL = "다른 카테고리";

/**
 * PAGE-22 미확정 정리. 확인이 필요한 결제(GET /transactions/pending)를 한 화면에 모아
 * 건별로 제안 세분류를 확정하거나 세분류 시트(PAGE-20)로 바꾼다 (FR-TXN-03). Pencil 시안 없음.
 * 일괄 확정(PUT /transactions/classifications)과 저녁 세션 코인은 P1 이라 여기서는 건별 확정만 한다.
 * 확정한 거래는 미확정 캐시에서 빠지므로 목록이 줄고, 다 비우면 빈 상태가 된다.
 */
function PendingCleanupScreen() {
  const router = useRouter();
  const pending = usePendingTransactions();
  const classify = useClassifyTransaction();
  const [sheetTransaction, setSheetTransaction] = useState<Transaction | null>(null);
  const subcategories = useSubcategories(sheetTransaction !== null);
  const items = flattenPending(pending.data);
  // 서버가 20건씩 주므로 더 남아 있으면 건수 뒤에 + 를 붙인다 — 받은 만큼만 세고 모르는 건 모른다고 적는다
  const countLabel = `${items.length}건${pending.hasNextPage ? "+" : ""}`;
  const submittingId = classify.isPending ? classify.variables?.transactionId : undefined;

  const submit = (transaction: Transaction, request: ClassifyRequest) => {
    classify.mutate(
      { transactionId: transaction.id, request, txDate: transaction.txDate },
      { onSuccess: () => setSheetTransaction(null) }
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="미확정 정리"
        onBack={() => (router.canGoBack() ? router.back() : router.replace(HOME_ROUTE))}
      />

      {pending.isPending ? (
        <CleanupSkeleton />
      ) : pending.data === undefined ? (
        <EmptyState
          icon={WifiOff}
          title="미확정 결제를 불러오지 못했어요"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={{ label: "다시 시도", onPress: () => pending.refetch(), disabled: pending.isFetching }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(transaction) => String(transaction.id)}
          contentContainerClassName="gap-3 px-6 pb-8"
          refreshing={pending.isRefetching && !pending.isFetchingNextPage}
          onRefresh={() => pending.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (pending.hasNextPage && !pending.isFetchingNextPage) void pending.fetchNextPage();
          }}
          ListHeaderComponent={
            items.length === 0 ? null : (
              <Text className="pb-1 text-body-sm text-card-foreground" accessibilityLiveRegion="polite">
                확인이 필요한 결제 {countLabel}
              </Text>
            )
          }
          ListFooterComponent={
            pending.isFetchingNextPage ? (
              <Skeleton className="h-32 w-full rounded-2xl" />
            ) : pending.isFetchNextPageError ? (
              <Button variant="outline" className="h-button-md rounded-lg" onPress={() => pending.fetchNextPage()}>
                <Text>더 불러오지 못했어요. 다시 시도</Text>
              </Button>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon={CheckCheck} title="정리할 결제가 없어요" description="새 결제가 들어오면 여기에 모아 둘게요." />
          }
          renderItem={({ item }) => (
            <PendingCard
              transaction={item}
              isPending={submittingId === item.id}
              errorMessage={classify.isError && classify.variables?.transactionId === item.id ? classifyErrorMessage(classify.error) : null}
              onConfirm={() => item.subcategoryId !== null && submit(item, { subcategoryId: item.subcategoryId })}
              onOther={() => setSheetTransaction(item)}
            />
          )}
        />
      )}

      <SubcategorySheet
        visible={sheetTransaction !== null}
        subcategories={subcategories.data}
        selectedSubcategoryId={sheetTransaction?.subcategoryId ?? null}
        amount={sheetTransaction?.amount ?? "0"}
        disabled={classify.isPending}
        onSelect={(request) => sheetTransaction && submit(sheetTransaction, request)}
        onClose={() => setSheetTransaction(null)}
      />
    </View>
  );
}

type PendingCardProps = {
  transaction: Transaction;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onOther: () => void;
};

// 코치 말풍선(FR-TXN-03)과 같은 두 선택지를 카드로 편 것 — 제안 세분류 확정 또는 세분류 시트.
// 서버가 제안 세분류를 주지 않는 거래(subcategoryName null)는 세분류 시트 버튼만 둔다.
function PendingCard({ transaction, isPending, errorMessage, onConfirm, onOther }: PendingCardProps) {
  const confirmLabel = transaction.subcategoryName === null ? null : `${transaction.subcategoryName} 확정`;

  return (
    <View className="gap-3 rounded-2xl bg-card p-5 shadow-sm shadow-black/5 dark:border dark:border-border dark:shadow-none">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-h3 text-foreground" numberOfLines={1}>
            {merchantLabel(transaction)}
          </Text>
          <Text className="text-caption text-card-foreground">{transactionDateTimeLabel(transaction)}</Text>
        </View>
        <Text className="text-amount-sm tabular-nums text-foreground" maxFontSizeMultiplier={1.3}>
          {formatKRW(subtractKRW("0", transaction.amount))}
        </Text>
      </View>

      <View className="flex-row gap-2">
        {confirmLabel === null ? null : (
          <Button className="h-button-md flex-1 rounded-lg" disabled={isPending} accessibilityLabel={confirmLabel} onPress={onConfirm}>
            <Text numberOfLines={1}>{confirmLabel}</Text>
          </Button>
        )}
        <Button
          variant="outline"
          className="h-button-md flex-1 rounded-lg"
          disabled={isPending}
          accessibilityLabel={OTHER_CATEGORY_LABEL}
          onPress={onOther}
        >
          <Text numberOfLines={1}>{OTHER_CATEGORY_LABEL}</Text>
        </Button>
      </View>

      {errorMessage === null ? null : (
        <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size={16} className="text-destructive" />
          <Text className="shrink text-caption text-destructive">{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const SKELETON_CARDS = [1, 2, 3];

function CleanupSkeleton() {
  return (
    <View className="gap-3 px-6 pt-2" accessible accessibilityLabel="불러오는 중">
      {SKELETON_CARDS.map((card) => (
        <Skeleton key={card} className="h-32 w-full rounded-2xl" />
      ))}
    </View>
  );
}

export { PendingCleanupScreen };
