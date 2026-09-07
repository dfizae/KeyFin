import { Image, Pressable, View } from "react-native";

import type { CharacterSummary } from "@/features/home/model";

// Pencil 홈 CharacterRoom (Rj36w) 327×596, 홈(캐릭터 활성화) CharacterRoom (Plvf1) 327×404.
// 이미지는 design/images 원본을 assets/images 로 복사한 것이며, 빈 방 이미지에는 CTA 버튼이 그려져 있다.
const EMPTY_ROOM = require("@/assets/images/character-room-empty.png");
const ACTIVE_ROOM = require("@/assets/images/character-room-active.png");
const EMPTY_ASPECT_RATIO = 327 / 596;
const ACTIVE_ASPECT_RATIO = 327 / 404;

// NativeWind 가 RN Image 에는 className 을 적용하지 않아(웹에서 확인: 클래스 문자열이 그대로 DOM 에 남고 원본 크기로 렌더링)
// 크기는 감싸는 View 가 잡고 Image 는 부모를 채우는 style 만 쓴다.
const FILL_PARENT = { width: "100%", height: "100%" } as const;

export const REGISTER_CHARACTER_LABEL = "캐릭터를 등록하세요";

type CharacterRoomProps = {
  character: CharacterSummary | null;
  onRegisterPress: () => void;
};

function CharacterRoom({ character, onRegisterPress }: CharacterRoomProps) {
  if (!character) {
    return (
      <View className="px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={REGISTER_CHARACTER_LABEL}
          accessibilityHint="캐릭터 등록 화면으로 이동합니다"
          onPress={onRegisterPress}
          className="w-full overflow-hidden rounded-xl active:opacity-80"
          style={{ aspectRatio: EMPTY_ASPECT_RATIO }}
        >
          <Image source={EMPTY_ROOM} resizeMode="cover" style={FILL_PARENT} accessible={false} />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="px-6">
      <View
        className="w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: ACTIVE_ASPECT_RATIO }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${character.name} 캐릭터가 방에 있어요`}
      >
        <Image source={ACTIVE_ROOM} resizeMode="cover" style={FILL_PARENT} accessible={false} />
      </View>
    </View>
  );
}

export { CharacterRoom };
export type { CharacterRoomProps };
