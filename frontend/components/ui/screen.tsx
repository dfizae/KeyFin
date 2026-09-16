import * as React from "react";
import {
  FlatList,
  ScrollView,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

/** 헤더 바와 본문 사이 간격 (2026-09-16 사용자 결정) */
export const HEADER_CONTENT_GAP = 24;
/** 상태바 아래 헤더 제목 행 높이(`min-h-20`) + 하단 보더 1 */
export const HEADER_BAR_HEIGHT = 80 + 1;

/** 헤더 전체 높이 = 상태바 영역 + 제목 행. 측정하지 않고 계산한다 — 측정에 기대면 첫 렌더에 본문이 헤더 아래로 들어간다 */
export function useHeaderHeight(): number {
  const insets = React.useContext(SafeAreaInsetsContext);
  return (insets?.top ?? 0) + HEADER_BAR_HEIGHT;
}

type ScreenScrollContextValue = {
  /** 본문 스크롤 위치. 헤더가 이 값으로 투명해진다 */
  scrollY: SharedValue<number>;
};

const ScreenScrollContext = React.createContext<ScreenScrollContextValue | null>(null);

export function useScreenScroll(): ScreenScrollContextValue | null {
  return React.useContext(ScreenScrollContext);
}

type ScreenProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * 헤더가 본문 위에 겹치는 화면의 뿌리. 안에 `ScreenHeader` 와 `ScreenScrollView`/`ScreenFlatList` 를 둔다.
 * 헤더는 절대 위치로 위에 떠 있고(상태바 영역까지 흰 면), 스크롤하면 투명해져 내용이 그 아래로 지나간다.
 * 헤더 자리는 `ScreenHeader` 가 같은 높이의 빈 공간을 흐름에 남겨 채우므로, 스크롤이 없는 상태(스켈레톤·빈 화면)도 헤더 아래에서 시작한다.
 */
function Screen({ children, className }: ScreenProps) {
  const scrollY = useSharedValue(0);
  const value = React.useMemo(() => ({ scrollY }), [scrollY]);

  return (
    <ScreenScrollContext.Provider value={value}>
      <View className={cn("flex-1 bg-background", className)}>{children}</View>
    </ScreenScrollContext.Provider>
  );
}

function useScrollTracking(onScroll: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined) {
  const context = useScreenScroll();
  const headerHeight = useHeaderHeight();
  const scrollY = context?.scrollY;
  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY?.set(event.nativeEvent.contentOffset.y);
      onScroll?.(event);
    },
    [scrollY, onScroll]
  );
  // 헤더 자리(빈 공간)만큼 위로 끌어올리고 내용은 그만큼 내려서, 쉬는 상태 배치는 그대로 두고 스크롤만 헤더 아래로 이어지게 한다
  const offset = context ? headerHeight + HEADER_CONTENT_GAP : 0;
  return { handleScroll, offset, overlaid: context !== null };
}

/** `Screen` 안에서 쓰는 ScrollView. 밖에서 쓰면 보통 ScrollView 와 같다 */
function ScreenScrollView({ onScroll, style, contentContainerStyle, ...props }: ScrollViewProps) {
  const { handleScroll, offset, overlaid } = useScrollTracking(onScroll);
  return (
    <ScrollView
      {...props}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      style={[style, overlaid ? { marginTop: -offset } : null]}
      contentContainerStyle={[contentContainerStyle, overlaid ? { paddingTop: offset } : null]}
    />
  );
}

/** `Screen` 안에서 쓰는 FlatList. 밖에서 쓰면 보통 FlatList 와 같다 */
function ScreenFlatList<ItemT>({ onScroll, style, contentContainerStyle, ...props }: FlatListProps<ItemT>) {
  const { handleScroll, offset, overlaid } = useScrollTracking(onScroll);
  return (
    <FlatList
      {...props}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      style={[style, overlaid ? { marginTop: -offset } : null]}
      contentContainerStyle={[contentContainerStyle, overlaid ? { paddingTop: offset } : null]}
    />
  );
}

export { Screen, ScreenFlatList, ScreenScrollView };
