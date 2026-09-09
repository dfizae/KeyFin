import { usePaymentCalendar } from "@/features/payment/api/queries";
import { CalendarPopover } from "@/features/payment/components/CalendarPopover";
import { upcomingEntry } from "@/features/payment/model";
import { CalendarAsset } from "@/features/room/components/CalendarAsset";
import { currentDateKey, formatMonthKeyLabel } from "@/lib/date";

type HomeCalendarProps = {
  /** 캔버스 폭(pt) */
  width: number;
  /** "YYYYMM" */
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * 방 벽의 캘린더 에셋과, 탭했을 때 열리는 출금 일정 팝오버 (FR-PAY-01·02).
 * 조회 실패는 에셋을 감추기만 한다 — 방과 다른 영역을 막지 않는다. (TBD: 실패 문구)
 */
function HomeCalendar({ width, month, open, onOpenChange }: HomeCalendarProps) {
  const calendar = usePaymentCalendar(month);
  if (!calendar.data) return null;

  const monthLabel = formatMonthKeyLabel(month);
  const upcoming = upcomingEntry(calendar.data, currentDateKey());

  return (
    <>
      <CalendarAsset
        width={width}
        monthLabel={monthLabel}
        upcoming={upcoming ? { day: upcoming.day, name: upcoming.name, hasShortage: !upcoming.prepared } : null}
        onPress={() => onOpenChange(true)}
      />
      {open ? <CalendarPopover width={width} calendar={calendar.data} monthLabel={monthLabel} onClose={() => onOpenChange(false)} /> : null}
    </>
  );
}

export { HomeCalendar };
export type { HomeCalendarProps };
