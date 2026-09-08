import { BoardPopover } from "@/features/budget/components/BoardPopover";
import { envelopeHealth, type Budget } from "@/features/budget/model";
import { WallBoard } from "@/features/room/components/WallBoard";
import { formatMonthKeyLabel } from "@/lib/date";

type HomeWallBoardProps = {
  /** 캔버스 폭(pt) */
  width: number;
  /** 예산을 아직 못 받았으면 undefined — 보드를 그리지 않는다 */
  budget: Budget | undefined;
  /** "YYYYMM" */
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** 방 벽의 보드 에셋과, 탭했을 때 열리는 봉투별 잔액 팝오버 (FR-BGT-04). 열림 상태는 벽 오브젝트끼리 하나만 열리도록 홈이 갖는다. */
function HomeWallBoard({ width, budget, month, open, onOpenChange }: HomeWallBoardProps) {
  if (!budget) return null;

  const monthLabel = formatMonthKeyLabel(month);

  return (
    <>
      <WallBoard
        width={width}
        monthLabel={monthLabel}
        remainingRate={budget.total?.remainingRate ?? null}
        chips={budget.envelopes.map(envelopeHealth)}
        onPress={() => onOpenChange(true)}
      />
      {open ? <BoardPopover width={width} budget={budget} monthLabel={monthLabel} onClose={() => onOpenChange(false)} /> : null}
    </>
  );
}

export { HomeWallBoard };
export type { HomeWallBoardProps };
