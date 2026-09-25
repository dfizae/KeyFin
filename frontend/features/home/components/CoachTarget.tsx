import { MessageCircleMore, X } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle } from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { CoachSpeechView } from "@/features/home/useCoachSpeech";
import { coachSpeechLayout, COACH_SPEECH_CLOSE_SIZE } from "@/features/home/coachSpeechLayout";

import { getSceneScale, type SceneSize } from "@/features/room/model";
import { COACH_CAT_RECT } from "@/features/room/scene";
import { useCoachCatMotion } from "@/features/room/useCoachCatMotion";

// 코치 = 방에 앉아 있는 고양이(AI 챗봇). 그림은 Skia 씬이 스프라이트(assets COACH_CAT)로 그리고, 여기에는 그 위에 얹는 탭 영역만 있다.
// 옛 Pencil CoachAvatar (Qxnt5) 32pt 원형 아이콘 버튼과 임시 "?" 말풍선(CoachBubble o3byv)을 대신한다 —
// 2026-09-22 사용자 요청으로 탭하면 코칭 대화 화면(PAGE-31)이 열리므로 말풍선은 없앴고, 미확정 정리 링크는 그 화면 상단으로 옮겼다.
export const COACH_LABEL = "코치";
export const COACH_SPEECH_HINT = "말풍선을 접습니다";
export const COACH_SPEECH_CLOSE_LABEL = "코치 말풍선 닫기";
export const COACH_SPEECH_ICON_LABEL = "코치가 할 말 보기";
/** 접힌 아이콘과 고양이 머리 위 간격(pt). 펼친 말풍선의 배치는 coachSpeechLayout에서 계산한다. */
const SPEECH_GAP = 4;
/** 접힌 대화 아이콘 버튼 크기(pt). 누르기 쉽게 hitSlop 을 더한다 */
const SPEECH_ICON_SIZE = 36;
const SPEECH_APPEAR_MS = 180;

type CoachTargetProps = {
  /** 캔버스 폭(pt). 씬 좌표를 이 폭으로 환산한다 */
  width: number;
  /** 실제 홈 표시 영역. 생략하면 캔버스 전체가 보이는 것으로 계산한다. */
  viewport?: SceneSize;
  /** 미확정 결제가 있으면 대화 아이콘에 빨간 점을 단다. 메시지가 없으면 아이콘도 없다. */
  hasPending?: boolean;
  /** 고양이가 머리 위로 하는 말. 펼치면 말풍선, 접으면 대화 아이콘이다. null 이면 둘 다 없다 */
  speech?: CoachSpeechView | null;
  onPress: () => void;
};

/** 제자리 사각형을 통째로 옮기는 틀. `Animated.View` 에는 className 이 먹지 않아 자리·크기를 스타일로 준다 */
const FILL = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 } as const;

/**
 * 고양이 그림 위의 투명한 탭 영역. 씬 레이어(sceneObjects)에 놓아야 확대·이동해도 그림과 같이 움직인다.
 * 고양이가 둥둥 떠서 오가므로(useCoachCatMotion) 탭 영역과 점도 같은 오프셋으로 따라간다.
 */
function CoachTarget({ width, viewport, hasPending = false, speech = null, onPress }: CoachTargetProps) {
  const scale = getSceneScale(width);
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
      {speech?.open ? (
        <CoachSpeech text={speech.text} width={width} viewport={viewport} onClose={speech.onClose} />
      ) : speech !== null ? (
        <CoachSpeechIcon scale={scale} unread={speech.unread || hasPending} onPress={speech.onPressIcon} />
      ) : null}
    </Animated.View>
  );
}

/**
 * 고양이 머리 위 말풍선 (사용자 요청 2026-09-23 — 예산 초과로 딱지·부스러기가 생겼을 때 상황을 알린다).
 * 고양이 머리 기준점 위의 칸 바닥에 왼쪽 아래 모서리를 붙인다. 부모의 이동 변환으로 고양이를 따라간다.
 * 고양이 쪽(왼쪽 아래) 모서리만 덜 둥글게 해 말하는 쪽을 가리킨다. 닫기 버튼을 누르면 대화 아이콘으로 접힌다.
 */
function CoachSpeech({ text, width, viewport, onClose }: { text: string; width: number; viewport?: SceneSize; onClose: () => void }) {
  const layout = coachSpeechLayout(width, viewport);
  return (
    <View
      testID="coach-speech-placement"
      className="absolute justify-end"
      style={{ left: layout.left, top: layout.top, height: layout.maxHeight, width: layout.maxWidth }}
      pointerEvents="box-none"
    >
      <Animated.View entering={FadeIn.duration(SPEECH_APPEAR_MS)}>
        <View
          testID="coach-speech-bubble"
          style={{ maxWidth: layout.maxWidth, maxHeight: layout.maxHeight }}
          className="self-start flex-row items-start gap-1 rounded-2xl rounded-bl-sm border border-transparent bg-card px-3 py-2 shadow-md shadow-black/20 dark:border-border dark:shadow-none"
        >
          {/* 세로 공간을 채우지 않고, 짧은 본문만 44pt 닫기 영역의 중앙에 맞춘다. */}
          <ScrollView
            testID="coach-speech-content"
            style={{ flexGrow: 0, flexShrink: 1, alignSelf: "center", maxWidth: layout.contentMaxWidth, maxHeight: layout.contentMaxHeight }}
            showsVerticalScrollIndicator
            bounces={false}
          >
            <Text accessibilityLabel={`${COACH_LABEL}: ${text}`} accessibilityLiveRegion="polite" className="text-body-sm text-foreground">
              {text}
            </Text>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={COACH_SPEECH_CLOSE_LABEL}
            accessibilityHint={COACH_SPEECH_HINT}
            onPress={onClose}
            style={{ width: COACH_SPEECH_CLOSE_SIZE, height: COACH_SPEECH_CLOSE_SIZE, flexShrink: 0 }}
            className="items-center justify-center rounded-full active:opacity-80"
          >
            <Icon as={X} size={20} className="text-foreground" />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * 말풍선을 접으면 남는 대화 아이콘 버튼. 고양이 머리 위 가운데에 두고, 누르면 말풍선을 다시 펼친다.
 * 아직 직접 열어 보지 않은 말이 있거나 정리할 미확정 결제가 있으면 오른쪽 위에 빨간 점을 달아 눌러 보도록 강조한다 —
 * 예전에 고양이 귀 옆에 따로 있던 미확정 결제 점을 이 점 하나로 합쳤다(사용자 요청 2026-09-23).
 */
function CoachSpeechIcon({
  scale,
  unread,
  onPress,
}: {
  scale: number;
  unread: boolean;
  onPress: () => void;
}) {
  const catCenter = (COACH_CAT_RECT.x + COACH_CAT_RECT.width / 2) * scale;
  return (
    <Animated.View
      entering={FadeIn.duration(SPEECH_APPEAR_MS)}
      style={{
        position: "absolute",
        left: catCenter - SPEECH_ICON_SIZE / 2,
        top: COACH_CAT_RECT.y * scale - SPEECH_GAP - SPEECH_ICON_SIZE,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unread ? `${COACH_SPEECH_ICON_LABEL}, 새 메시지` : COACH_SPEECH_ICON_LABEL
        }
        accessibilityHint="코치의 말풍선을 다시 펼칩니다"
        hitSlop={6}
        onPress={onPress}
        className="h-9 w-9 items-center justify-center rounded-full bg-card shadow-md shadow-black/20 active:opacity-80 dark:border dark:border-border dark:shadow-none"
      >
        <Icon as={MessageCircleMore} size={20} className="text-primary" />
        {unread ? (
          <View accessible={false} className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export { CoachTarget };
export type { CoachTargetProps };
