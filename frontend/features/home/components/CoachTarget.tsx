import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { Text } from "@/components/ui/text";

import { getSceneScale } from "@/features/room/model";
import { COACH_CAT_RECT } from "@/features/room/scene";
import { useCoachCatMotion } from "@/features/room/useCoachCatMotion";

// 코치 = 방에 앉아 있는 고양이(AI 챗봇). 그림은 Skia 씬이 스프라이트(assets COACH_CAT)로 그리고, 여기에는 그 위에 얹는 탭 영역만 있다.
// 옛 Pencil CoachAvatar (Qxnt5) 32pt 원형 아이콘 버튼과 임시 "?" 말풍선(CoachBubble o3byv)을 대신한다 —
// 2026-09-22 사용자 요청으로 탭하면 코칭 대화 화면(PAGE-31)이 열리므로 말풍선은 없앴고, 미확정 정리 링크는 그 화면 상단으로 옮겼다.
export const COACH_LABEL = "코치";
export const COACH_SPEECH_HINT = "말풍선을 닫습니다";
const BADGE_SIZE = 12;
/** 말풍선 최대 폭과 고양이 머리 위 간격(pt). 폭은 화면 기준이라 씬 배율을 곱하지 않는다 */
const SPEECH_MAX_WIDTH = 230;
const SPEECH_GAP = 4;

type CoachTargetProps = {
  /** 캔버스 폭(pt). 씬 좌표를 이 폭으로 환산한다 */
  width: number;
  /** 미확정 결제가 있으면 귀 옆에 빨간 점을 단다 */
  hasPending?: boolean;
  /** 고양이가 머리 위 말풍선으로 하는 말. null 이면 말풍선이 없다 */
  speech?: string | null;
  /** 말풍선을 눌렀을 때(닫기) */
  onSpeechPress?: () => void;
  onPress: () => void;
};

/** 제자리 사각형을 통째로 옮기는 틀. `Animated.View` 에는 className 이 먹지 않아 자리·크기를 스타일로 준다 */
const FILL = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 } as const;

/**
 * 고양이 그림 위의 투명한 탭 영역. 씬 레이어(sceneObjects)에 놓아야 확대·이동해도 그림과 같이 움직인다.
 * 고양이가 둥둥 떠서 오가므로(useCoachCatMotion) 탭 영역과 점도 같은 오프셋으로 따라간다.
 */
function CoachTarget({ width, hasPending = false, speech = null, onSpeechPress, onPress }: CoachTargetProps) {
  const scale = getSceneScale(width);
  const badge = BADGE_SIZE * scale;
  const offset = useCoachCatMotion();
  const follow = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value.x * scale }, { translateY: offset.value.y * scale }],
  }));

  return (
    <Animated.View style={[FILL, follow]} pointerEvents="box-none">
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
      {speech === null ? null : <CoachSpeech text={speech} scale={scale} onPress={onSpeechPress} />}
    </Animated.View>
  );
}

/**
 * 고양이 머리 위 말풍선 (사용자 요청 2026-09-23 — 예산 초과로 딱지·부스러기가 생겼을 때 상황을 알린다).
 * 고양이 윗변에 아래쪽을 붙이려고, 방 맨 위부터 고양이 윗변까지의 칸을 만들고 그 바닥에 말풍선을 둔다.
 * 고양이 쪽(왼쪽 아래) 모서리만 덜 둥글게 해 말하는 쪽을 가리킨다. 누르면 닫힌다.
 */
function CoachSpeech({ text, scale, onPress }: { text: string; scale: number; onPress?: () => void }) {
  return (
    <View
      className="absolute justify-end"
      style={{ left: COACH_CAT_RECT.x * scale, top: 0, height: COACH_CAT_RECT.y * scale - SPEECH_GAP, maxWidth: SPEECH_MAX_WIDTH }}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${COACH_LABEL}: ${text}`}
        accessibilityHint={COACH_SPEECH_HINT}
        accessibilityLiveRegion="polite"
        onPress={onPress}
        className="self-start rounded-2xl rounded-bl-sm bg-card px-3 py-2 shadow-md shadow-black/20 active:opacity-80 dark:border dark:border-border dark:shadow-none"
      >
        <Text className="text-body-sm text-foreground">{text}</Text>
      </Pressable>
    </View>
  );
}

export { CoachTarget };
export type { CoachTargetProps };
