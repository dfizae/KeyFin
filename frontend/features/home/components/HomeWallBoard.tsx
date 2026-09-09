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
  onOpen: () => void;
};

/** 방 벽의 보드 에셋 (FR-BGT-04). 방 안의 오브젝트라 카메라를 따라 함께 확대·이동한다. */
function HomeWallBoard({ width, budget, month, onOpen }: HomeWallBoardProps) {
  if (!budget) return null;

  return (
    <WallBoard
      width={width}
      monthLabel={formatMonthKeyLabel(month)}
      remainingRate={budget.total?.remainingRate ?? null}
      chips={budget.envelopes.map(envelopeHealth)}
      onPress={onOpen}
    />
  );
}

type HomeBoardPanelProps = {
  width: number;
  budget: Budget | undefined;
  month: string;
  onClose: () => void;
};

/** 보드를 탭했을 때 열리는 봉투별 잔액 팝오버. 카메라 밖 레이어라 확대 배율과 무관하게 그려진다. */
function HomeBoardPanel({ width, budget, month, onClose }: HomeBoardPanelProps) {
  if (!budget) return null;

  return <BoardPopover width={width} budget={budget} monthLabel={formatMonthKeyLabel(month)} onClose={onClose} />;
}

export { HomeBoardPanel, HomeWallBoard };
export type { HomeBoardPanelProps, HomeWallBoardProps };
