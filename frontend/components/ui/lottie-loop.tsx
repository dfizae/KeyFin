import type { AnimationObject } from "lottie-react-native";
import type * as React from "react";
import { View } from "react-native";

type LottieLoopProps = {
  /** `require("@/assets/lottie/<name>.json")` — Metro 가 JSON 을 객체로 준다 */
  source: AnimationObject;
  width: number;
  height: number;
  accessibilityLabel?: string;
  /** 애니메이션을 못 그리는 환경(웹)에서 대신 보여줄 것. 없으면 같은 크기의 빈 자리만 잡는다. */
  fallback?: React.ReactNode;
};

// 웹 구현. lottie-react-native 의 웹 렌더러는 @lottiefiles/dotlottie-react 를 따로 요구하므로
// 웹(개발 중 확인용)에서는 애니메이션 대신 fallback 을 그린다. 기기에서는 lottie-loop.native.tsx 가 쓰인다.
function LottieLoop({ width, height, fallback }: LottieLoopProps) {
  return <View style={{ width, height }}>{fallback}</View>;
}

export { LottieLoop };
export type { LottieLoopProps };
