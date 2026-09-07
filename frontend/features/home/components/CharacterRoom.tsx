import { Image, Pressable, View } from "react-native";

import type { CharacterSummary } from "@/features/home/model";
import { RoomSceneLoader } from "@/features/room/components/RoomSceneLoader";

// Pencil 홈 CharacterRoom (Rj36w) 327×596, 홈(캐릭터 활성화) CharacterRoom (Plvf1) 327×404.
// 빈 방은 정지 이미지(CTA 버튼이 그려져 있음), 캐릭터가 있으면 Skia 방 씬(features/room)을 그린다.
const EMPTY_ROOM = require("@/assets/images/character-room-empty.png");
const EMPTY_ASPECT_RATIO = 327 / 596;

// 웹의 RN Image 는 원본 크기를 인라인 style 로 넣어 className(w-full)보다 우선한다(웹에서 확인).
// 그래서 크기는 감싸는 View 가 잡고 Image 는 부모를 채우는 style 만 쓴다.
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
    <View className="px-6" accessible accessibilityRole="image" accessibilityLabel={`${character.name} 캐릭터가 방에 있어요`}>
      <RoomSceneLoader />
    </View>
  );
}

export { CharacterRoom };
export type { CharacterRoomProps };
