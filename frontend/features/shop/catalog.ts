import { CalendarCheck, CalendarRange, Coins, ListChecks, ShoppingBag, Trophy, type LucideIcon } from "lucide-react-native";

import type { CoinReason } from "@/features/shop/model";

/** 코인 사유별 아이콘 (Pencil PAGE-30 코인 이력 f7YQj Icon tile). 사유 코드는 계약이고 아이콘은 클라이언트 상수다 */
const COIN_REASON_ICONS: Record<CoinReason, LucideIcon> = {
  ATTEND: CalendarCheck,
  CONFIRM_ALL: ListChecks,
  WEEKLY: CalendarRange,
  MONTHLY: Trophy,
  PURCHASE: ShoppingBag,
  UNKNOWN: Coins,
};

export function coinReasonIcon(reason: CoinReason): LucideIcon {
  return COIN_REASON_ICONS[reason];
}
