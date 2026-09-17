import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Floating } from "@/components/ui/floating";
import type { IntroReveal } from "@/components/ui/intro-reveal";
import { Sprite, type SpriteFrames } from "@/components/ui/sprite";
import { Text } from "@/components/ui/text";

type CoachRowProps = {
  /** `features/room/assets` 의 `CHARACTER_FRAMES` 포즈 묶음 */
  frames: SpriteFrames;
  message: string;
  /** 첫 화면 연출(useIntroReveal). 주면 캐릭터가 크게 나타났다 제자리로 줄고 말풍선이 뒤따라 나타난다 */
  intro?: IntroReveal;
};

/** Pencil CoachRow 의 캐릭터 76×112. 4px 스케일 밖 값이라 크기만 style 로 준다 */
const CHARACTER_STYLE = { width: 76, height: 112 } as const;
// Animated.View 에는 className 이 안 먹어 flex-1 만 style 로 준다
const FLEX_ONE = { flex: 1 } as const;

// 온보딩 코치 행: 둥실거리는 캐릭터 + 말풍선 카드. 홈 코치 말풍선(bg-card · border-border · rounded-lg)과 같은 스타일이다.
// Pencil 회원가입(b66wKg) · 약관(f0WyT) · 금융망 이메일(PqGvX) 캐릭터 대안의 CoachRow.
function CoachRow({ frames, message, intro }: CoachRowProps) {
  return (
    <View className="flex-row items-start gap-3">
      <Animated.View ref={intro?.characterRef} onLayout={intro?.onCharacterLayout} style={intro?.characterStyle}>
        <Floating>
          <Sprite frames={frames} style={CHARACTER_STYLE} />
        </Floating>
      </Animated.View>
      <Animated.View style={[FLEX_ONE, intro?.revealStyle]}>
        <View className="rounded-lg border border-border bg-card p-3.5">
          <Text className="text-label text-foreground">{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export { CoachRow };
