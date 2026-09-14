import { useRouter } from "expo-router";

import { usePaymentCalendar } from "@/features/payment/api/queries";
import { CalendarPopover } from "@/features/payment/components/CalendarPopover";
import { upcomingEntry } from "@/features/payment/model";
import { CalendarAsset } from "@/features/room/components/CalendarAsset";
import { currentDateKey, formatMonthKeyLabel } from "@/lib/date";

const PAYMENT_CALENDAR_ROUTE = "/payment/calendar";

type HomeCalendarProps = {
  /** 캔버스 폭(pt) */
  width: number;
  /** "YYYYMM" */
  month: string;
  onOpen: () => void;
};

/**
 * 방 벽의 캘린더 에셋 (FR-PAY-01·02). 방 안의 오브젝트라 카메라를 따라 함께 확대·이동한다.
 * 조회 실패는 에셋을 감추기만 한다 — 방과 다른 영역을 막지 않는다. (TBD: 실패 문구)
 */
function HomeCalendar({ width, month, onOpen }: HomeCalendarProps) {
  const calendar = usePaymentCalendar(month);
  if (!calendar.data) return null;

  const upcoming = upcomingEntry(calendar.data, currentDateKey());

  return (
    <CalendarAsset
      width={width}
      monthLabel={formatMonthKeyLabel(month)}
      upcoming={upcoming ? { day: upcoming.day, name: upcoming.name, hasShortage: !upcoming.prepared } : null}
      onPress={onOpen}
    />
  );
}

type HomeCalendarPanelProps = {
  width: number;
  month: string;
  onClose: () => void;
};

/** 캘린더를 탭했을 때 열리는 출금 일정 팝오버. 카메라 밖 레이어라 확대 배율과 무관하게 그려진다. */
function HomeCalendarPanel({ width, month, onClose }: HomeCalendarPanelProps) {
  const router = useRouter();
  const calendar = usePaymentCalendar(month);
  if (!calendar.data) return null;

  return (
    <CalendarPopover
      width={width}
      calendar={calendar.data}
      monthLabel={formatMonthKeyLabel(month)}
      onClose={onClose}
      onOpenCalendar={() => router.push(PAYMENT_CALENDAR_ROUTE)}
    />
  );
}

export { HomeCalendar, HomeCalendarPanel };
export type { HomeCalendarPanelProps, HomeCalendarProps };
