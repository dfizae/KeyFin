import { ChevronLeft } from "lucide-react-native";
import type * as React from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type ScreenHeaderProps = {
  title: string;
  /** 없으면 뒤로가기 버튼을 그리지 않는다(홈에서 강제로 온 예산 확정처럼 돌아갈 곳이 없을 때) */
  onBack?: () => void;
  /** 오른쪽 끝 액션 — '전체 선택' 텍스트 버튼, '+' 아이콘 버튼 등 */
  right?: React.ReactNode;
  className?: string;
};

// 화면 헤더는 이 한 종류다: `<` + text-h1 제목 (+ 오른쪽 액션). Pencil `ScreenHeader` 컴포넌트와 같다.
// 안전 영역 상단은 라우트의 SafeAreaView 가 맡으므로 여기엔 위 여백이 없다.
function ScreenHeader({ title, onBack, right, className }: ScreenHeaderProps) {
  return (
    <View className={cn("flex-row items-center gap-3 px-6 pb-3", className)}>
      {onBack === undefined ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={10} onPress={onBack}>
          <Icon as={ChevronLeft} size={24} className="text-foreground" />
        </Pressable>
      )}
      <Text className="flex-1 text-h1 text-foreground" accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export { ScreenHeader };
