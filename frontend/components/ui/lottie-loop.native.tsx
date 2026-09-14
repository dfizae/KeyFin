import LottieView from "lottie-react-native";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import type { LottieLoopProps } from "@/components/ui/lottie-loop";

// 네이티브 구현. 동작 줄이기 설정이면 첫 프레임에 멈춰 둔다.
// LottieView 는 접근성 prop 을 받지 않아 감싸는 View 에 붙인다.
function LottieLoop({ source, width, height, accessibilityLabel }: LottieLoopProps) {
  const reducedMotion = useReducedMotion();

  return (
    <View accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel}>
      <LottieView
        source={source}
        autoPlay={!reducedMotion}
        loop
        progress={reducedMotion ? 0 : undefined}
        style={{ width, height }}
      />
    </View>
  );
}

export { LottieLoop };
