import { Pressable, View } from "react-native";

import { getSceneScale } from "@/features/room/model";
import { COACH_CAT_RECT } from "@/features/room/scene";

// 코치 = 방에 앉아 있는 고양이(AI 챗봇). 그림은 Skia 씬이 스프라이트(assets COACH_CAT)로 그리고, 여기에는 그 위에 얹는 탭 영역만 있다.
// 옛 Pencil CoachAvatar (Qxnt5) 32pt 원형 아이콘 버튼과 임시 "?" 말풍선(CoachBubble o3byv)을 대신한다 —
// 2026-09-22 사용자 요청으로 탭하면 코칭 대화 화면(PAGE-31)이 열리므로 말풍선은 없앴고, 미확정 정리 링크는 그 화면 상단으로 옮겼다.
export const COACH_LABEL = "코치";
const BADGE_SIZE = 12;

type CoachTargetProps = {
  /** 캔버스 폭(pt). 씬 좌표를 이 폭으로 환산한다 */
  width: number;
  /** 미확정 결제가 있으면 귀 옆에 빨간 점을 단다 */
  hasPending?: boolean;
  onPress: () => void;
};

/** 고양이 그림 위의 투명한 탭 영역. 씬 레이어(sceneObjects)에 놓아야 확대·이동해도 그림과 같이 움직인다 */
function CoachTarget({ width, hasPending = false, onPress }: CoachTargetProps) {
  const scale = getSceneScale(width);
  const badge = BADGE_SIZE * scale;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={COACH_LABEL}
        accessibilityHint="코치와 대화하는 화면을 엽니다"
        onPress={onPress}
        hitSlop={8}
        className="absolute active:opacity-80"
        style={{
          left: COACH_CAT_RECT.x * scale,
          top: COACH_CAT_RECT.y * scale,
          width: COACH_CAT_RECT.width * scale,
          height: COACH_CAT_RECT.height * scale,
        }}
      />
      {hasPending ? (
        <View
          accessible={false}
          className="absolute rounded-full bg-destructive"
          style={{
            left: (COACH_CAT_RECT.x + COACH_CAT_RECT.width) * scale - badge * 0.8,
            top: COACH_CAT_RECT.y * scale,
            width: badge,
            height: badge,
          }}
        />
      ) : null}
    </>
  );
}

export { CoachTarget };
export type { CoachTargetProps };
