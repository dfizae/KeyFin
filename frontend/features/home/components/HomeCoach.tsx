import * as React from "react";

import { CoachBubble } from "@/features/home/components/CoachBubble";
import { useClassifyTransaction, usePendingTransactions, useSubcategories } from "@/features/transaction/api/queries";
import { SubcategorySheet } from "@/features/transaction/components/SubcategorySheet";
import type { ClassifyRequest } from "@/features/transaction/model";

export const CLASSIFY_ERROR_MESSAGE = "분류를 저장하지 못했어요. 다시 시도해 주세요.";

type HomeCoachProps = {
  /** 캔버스 폭(pt) */
  width: number;
};

/**
 * 방의 코치: 미확정 거래의 첫 건을 말풍선으로 묻고, [확정]은 제안된 세분류로, [다른 카테고리]는 세분류 시트로 분류한다 (FR-TXN-03).
 * 미확정 조회 실패는 코치만 두고 조용히 넘긴다 — 홈의 다른 영역을 막지 않는다. (TBD: 실패 문구)
 */
function HomeCoach({ width }: HomeCoachProps) {
  const pending = usePendingTransactions();
  const classify = useClassifyTransaction();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const subcategories = useSubcategories(sheetOpen);
  const transaction = pending.data?.items[0] ?? null;

  const submit = (request: ClassifyRequest) => {
    if (!transaction) return;
    classify.mutate(
      { transactionId: transaction.id, request, monthKey: transaction.monthKey },
      { onSuccess: () => setSheetOpen(false) }
    );
  };

  return (
    <>
      <CoachBubble
        width={width}
        transaction={transaction}
        isPending={classify.isPending}
        errorMessage={classify.isError ? CLASSIFY_ERROR_MESSAGE : null}
        onConfirm={() => transaction && submit({ subcategoryId: transaction.subcategoryId })}
        onOther={() => setSheetOpen(true)}
      />
      <SubcategorySheet
        visible={sheetOpen}
        subcategories={subcategories.data}
        selectedSubcategoryId={transaction?.subcategoryId ?? null}
        disabled={classify.isPending}
        onSelect={submit}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

export { HomeCoach };
export type { HomeCoachProps };
