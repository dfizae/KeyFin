import { useRouter } from "expo-router";
import { ChevronLeft, CircleAlert, Receipt } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { envelopeIcon, envelopeName } from "@/features/budget/catalog";
import { useCachedTransaction, useClassifyTransaction, useSubcategories } from "@/features/transaction/api/queries";
import { SubcategorySheet } from "@/features/transaction/components/SubcategorySheet";
import { classifyErrorMessage } from "@/features/transaction/errors";
import {
  confirmStatusLabel,
  isIncoming,
  reclassifyBlockedReason,
  transactionBadge,
  transactionCategoryLabel,
  transactionDateTimeLabel,
  txTypeLabel,
  type ClassifyRequest,
  type Transaction,
} from "@/features/transaction/model";
import { formatKRW, subtractKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

const TRANSACTION_LIST_ROUTE = "/transaction";

type TransactionDetailScreenProps = {
  /** 라우트 파라미터에서 검증한 거래 id. 형식이 틀리면 null */
  transactionId: number | null;
};

/**
 * PAGE-21 거래 상세. 단건 조회 API 가 없어 들어온 목록 캐시의 거래를 보여주고(useCachedTransaction),
 * 분류 수정은 PAGE-20 시트로 한다 (docs/frontend-spec.md §2). Pencil 시안 없음.
 * 분류를 바꾸면 그 거래는 미확정 목록에서 빠지므로 상세를 닫고 들어온 목록으로 돌아간다.
 */
function TransactionDetailScreen({ transactionId }: TransactionDetailScreenProps) {
  const router = useRouter();
  const transaction = useCachedTransaction(transactionId);
  const classify = useClassifyTransaction();
  const [sheetOpen, setSheetOpen] = useState(false);
  const subcategories = useSubcategories(sheetOpen);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(TRANSACTION_LIST_ROUTE);
  };

  const submit = (request: ClassifyRequest) => {
    if (!transaction) return;
    classify.mutate(
      { transactionId: transaction.id, request, txDate: transaction.txDate },
      {
        onSuccess: () => {
          setSheetOpen(false);
          goBack();
        },
      }
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 px-6 pb-3">
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={10} onPress={goBack}>
          <Icon as={ChevronLeft} size={24} className="text-foreground" />
        </Pressable>
        <Text className="text-h3 text-foreground" accessibilityRole="header">
          거래 상세
        </Text>
      </View>

      {transaction === null ? (
        <EmptyState
          icon={Receipt}
          title="거래를 찾을 수 없어요"
          description="목록에서 거래를 다시 선택해 주세요."
          action={{ label: "거래 내역", onPress: () => router.replace(TRANSACTION_LIST_ROUTE) }}
        />
      ) : (
        <>
          <ScrollView contentContainerClassName="gap-5 px-6 pb-10">
            <AmountSummary transaction={transaction} />
            <ClassificationCard
              transaction={transaction}
              isPending={classify.isPending}
              errorMessage={classify.isError ? classifyErrorMessage(classify.error) : null}
              onReclassify={() => setSheetOpen(true)}
            />
          </ScrollView>
          <SubcategorySheet
            visible={sheetOpen}
            subcategories={subcategories.data}
            selectedSubcategoryId={transaction.subcategoryId}
            disabled={classify.isPending}
            onSelect={submit}
            onClose={() => setSheetOpen(false)}
          />
        </>
      )}
    </View>
  );
}

type AmountSummaryProps = { transaction: Transaction };

function AmountSummary({ transaction }: AmountSummaryProps) {
  const incoming = isIncoming(transaction);
  const badge = transactionBadge(transaction);
  const amount = incoming
    ? formatKRW(transaction.amount, { sign: "always" })
    : formatKRW(subtractKRW("0", transaction.amount));

  return (
    <View className="gap-2 rounded-2xl bg-card p-5">
      <View className="flex-row items-center gap-2">
        <Text className="shrink text-h2 text-foreground" numberOfLines={2}>
          {transaction.merchantName}
        </Text>
        {badge === null ? null : (
          <Badge variant="secondary">
            <Text>{badge}</Text>
          </Badge>
        )}
      </View>
      <Text
        className={cn(
          "text-amount-lg tabular-nums",
          incoming ? "text-positive" : "text-foreground",
          transaction.status === "CANCELED" && "text-muted-foreground line-through"
        )}
        maxFontSizeMultiplier={1.3}
      >
        {amount}
      </Text>
      <Text className="text-caption text-muted-foreground">{transactionDateTimeLabel(transaction)}</Text>
    </View>
  );
}

type ClassificationCardProps = {
  transaction: Transaction;
  isPending: boolean;
  errorMessage: string | null;
  onReclassify: () => void;
};

function ClassificationCard({ transaction, isPending, errorMessage, onReclassify }: ClassificationCardProps) {
  const blockedReason = reclassifyBlockedReason(transaction);
  const status = confirmStatusLabel(transaction);
  const disabled = blockedReason !== null || isPending;

  return (
    <View className="gap-4 rounded-2xl bg-card p-5">
      <View className="flex-row items-center gap-3">
        <View className="h-icon-tile w-icon-tile items-center justify-center rounded-md bg-accent">
          <Icon as={envelopeIcon(transaction.envelopeId)} size={20} className="text-primary" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-label text-foreground">{envelopeName(transaction.envelopeId)}</Text>
          <Text className="text-caption text-muted-foreground">{transactionCategoryLabel(transaction)}</Text>
        </View>
        {status === null ? null : <Text className="text-caption text-muted-foreground">{status}</Text>}
      </View>

      <DetailRow label="거래 종류" value={txTypeLabel(transaction)} />
      {transaction.memo === null ? null : <DetailRow label="메모" value={transaction.memo} />}

      <Button
        variant="outline"
        className="h-button-md rounded-lg"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={onReclassify}
      >
        <Text className="text-button">{isPending ? "저장 중" : "분류 바꾸기"}</Text>
      </Button>
      {blockedReason === null ? null : <Text className="text-caption text-muted-foreground">{blockedReason}</Text>}
      {errorMessage === null ? null : (
        <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
          <Icon as={CircleAlert} size={16} className="text-destructive" />
          <Text className="shrink text-caption text-destructive">{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

type DetailRowProps = { label: string; value: string };

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-caption text-muted-foreground">{label}</Text>
      <Text className="shrink text-body-sm text-foreground">{value}</Text>
    </View>
  );
}

export { TransactionDetailScreen };
export type { TransactionDetailScreenProps };
