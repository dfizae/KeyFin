import { CreditCard, House, Landmark, Repeat, Zap, type LucideIcon } from "lucide-react-native";

import type { ExpenseType } from "@/features/payment/model";

/**
 * 고정지출 유형 5종(ExpenseType). 값은 계약(docs/api-contract.md 열거형)이고 라벨·아이콘·순서는 클라이언트 상수다.
 * UTILITY 는 달마다 금액이 달라 요청에 isVariable=true 가 붙는다 (FR-PAY-09).
 */
export const EXPENSE_TYPE_CATALOG: { type: ExpenseType; label: string; icon: LucideIcon }[] = [
  { type: "RENT", label: "월세·관리비", icon: House },
  { type: "SUBSCRIPTION", label: "구독", icon: Repeat },
  { type: "CARD_BILL", label: "카드 대금", icon: CreditCard },
  { type: "LOAN", label: "대출 상환", icon: Landmark },
  { type: "UTILITY", label: "공과금", icon: Zap },
];

export function expenseTypeLabel(type: ExpenseType): string {
  return EXPENSE_TYPE_CATALOG.find((entry) => entry.type === type)?.label ?? "기타";
}
