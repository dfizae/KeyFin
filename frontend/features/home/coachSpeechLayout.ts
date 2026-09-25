import { getCanvasSize, getSceneScale, type SceneSize } from "@/features/room/model";
import { COACH_CAT_FLOAT_HEIGHT, COACH_CAT_STROLL_RANGE, COACH_SPEECH_ANCHOR } from "@/features/room/scene";

export const COACH_SPEECH_CLOSE_SIZE = 44;
const MAX_WIDTH = 230;
const MAX_HEIGHT = 240;
const CAT_GAP = 8;
const SCREEN_MARGIN = 8;
const PADDING_X = 24;
const PADDING_Y = 16;
const BORDER = 2;
const CONTENT_GAP = 4;

/**
 * 카메라가 1배일 때 홈의 중앙 잘림을 고려한 말풍선 범위. 반환 좌표는 씬 캔버스 기준이다.
 * 고양이 이동값은 부모가 한 번만 적용한다. 최대 이동분을 미리 비워 폭·높이 상한은 산책 중에도 고정한다.
 */
export function coachSpeechLayout(width: number, viewport: SceneSize = getCanvasSize(width)) {
  const scale = getSceneScale(width);
  const canvas = getCanvasSize(width);
  const insetX = Math.max(0, (canvas.width - viewport.width) / 2);
  const insetY = Math.max(0, (canvas.height - viewport.height) / 2);
  const visibleRight = Math.min(canvas.width, insetX + viewport.width);
  const left = COACH_SPEECH_ANCHOR.x * scale;
  const bottom = COACH_SPEECH_ANCHOR.y * scale - CAT_GAP;
  const topLimit = insetY + SCREEN_MARGIN + COACH_CAT_FLOAT_HEIGHT * scale;
  const maxWidth = Math.max(0, Math.min(MAX_WIDTH, visibleRight - SCREEN_MARGIN - left - COACH_CAT_STROLL_RANGE.right * scale));
  const maxHeight = Math.max(0, Math.min(MAX_HEIGHT, bottom - topLimit));

  return {
    left,
    top: bottom - maxHeight,
    maxWidth,
    maxHeight,
    contentMaxWidth: Math.max(0, maxWidth - PADDING_X - BORDER - CONTENT_GAP - COACH_SPEECH_CLOSE_SIZE),
    contentMaxHeight: Math.max(0, maxHeight - PADDING_Y - BORDER),
  };
}
