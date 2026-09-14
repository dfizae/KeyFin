import { Image, type ImageSourcePropType, View } from "react-native";

import { Floating } from "@/components/ui/floating";
import { Text } from "@/components/ui/text";

type CoachRowProps = {
  /** `features/room/assets` 의 캐릭터 포즈 */
  character: ImageSourcePropType;
  message: string;
};

/** Pencil CoachRow 의 캐릭터 76×112. 4px 스케일 밖 값이라 크기만 style 로 준다 */
const CHARACTER_STYLE = { width: 76, height: 112 } as const;

// 온보딩 코치 행: 둥실거리는 캐릭터 + 말풍선 카드. 홈 코치 말풍선(bg-card · border-border · rounded-lg)과 같은 스타일이다.
// Pencil 회원가입(b66wKg) · 약관(f0WyT) · 금융망 이메일(PqGvX) 캐릭터 대안의 CoachRow.
function CoachRow({ character, message }: CoachRowProps) {
  return (
    <View className="flex-row items-start gap-3">
      <Floating>
        <Image source={character} style={CHARACTER_STYLE} resizeMode="contain" accessible={false} />
      </Floating>
      <View className="flex-1 rounded-lg border border-border bg-card p-3.5">
        <Text className="text-label text-foreground">{message}</Text>
      </View>
    </View>
  );
}

export { CoachRow };
