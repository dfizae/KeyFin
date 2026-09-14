import { BoardPopover } from "@/features/budget/components/BoardPopover";
import { budgetPeriodLabel, budgetPeriodShortLabel, envelopeHealth, type Budget } from "@/features/budget/model";
import { WallBoard } from "@/features/room/components/WallBoard";

type HomeWallBoardProps = {
  /** 캔버스 폭(pt) */
  width: number;
  /** 예산을 아직 못 받았으면 undefined — 보드를 그리지 않는다 */
  budget: Budget | undefined;
  onOpen: () => void;
};

/**
 * 방 벽의 보드 에셋 (FR-BGT-04). 방 안의 오브젝트라 카메라를 따라 함께 확대·이동한다.
 * 주기 라벨(month)은 기준일 사용자에게 달력 월과 달라 쓰지 않고 기간을 보여 준다 — 보드가 좁아 "9.1~9.30" 으로 줄인다.
 */
function HomeWallBoard({ width, budget, onOpen }: HomeWallBoardProps) {
  if (!budget) return null;

  return (
    <WallBoard
      width={width}
      periodLabel={budgetPeriodShortLabel(budget)}
      periodAccessibilityLabel={budgetPeriodLabel(budget)}
      remainingRate={budget.total?.remainingRate ?? null}
      chips={budget.envelopes.map(envelopeHealth)}
      onPress={onOpen}
    />
  );
}

type HomeBoardPanelProps = {
  width: number;
  budget: Budget | undefined;
  onClose: () => void;
};

/** 보드를 탭했을 때 열리는 봉투별 잔액 팝오버. 카메라 밖 레이어라 확대 배율과 무관하게 그려진다. */
function HomeBoardPanel({ width, budget, onClose }: HomeBoardPanelProps) {
  if (!budget) return null;

  return <BoardPopover width={width} budget={budget} periodLabel={budgetPeriodLabel(budget)} onClose={onClose} />;
}

export { HomeBoardPanel, HomeWallBoard };
export type { HomeBoardPanelProps, HomeWallBoardProps };
