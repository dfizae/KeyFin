import * as React from "react";
import { View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import { cn } from "@/lib/utils";

const KNOB_SIZE = 18;

type SliderProps = {
  value: number;
  max: number;
  min?: number;
  step?: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

/**
 * 손잡이 하나짜리 슬라이더. RN 코어 responder 이벤트만 써서 네이티브와 웹(Expo web)에서 같게 동작한다.
 * 트랙 어디를 눌러도 그 지점으로 값이 옮겨가고, 끄는 동안에는 손가락 위치를 따라간다.
 */
function Slider({
  value,
  max,
  min = 0,
  step = 1,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  className,
}: SliderProps) {
  const [width, setWidth] = React.useState(0);

  const snap = (raw: number) => Math.round(Math.min(max, Math.max(min, raw)) / step) * step;

  const moveTo = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const next = snap(min + (event.nativeEvent.locationX / width) * (max - min));
    if (next !== value) onValueChange(next);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const knobLeft = Math.min(Math.max(0, width - KNOB_SIZE), Math.max(0, ratio * width - KNOB_SIZE / 2));

  return (
    <View
      className={cn("h-5 w-full justify-center", disabled && "opacity-50", className)}
      onLayout={handleLayout}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={moveTo}
      onResponderMove={moveTo}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[
        { name: "increment", label: "늘리기" },
        { name: "decrement", label: "줄이기" },
      ]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        onValueChange(snap(value + (event.nativeEvent.actionName === "increment" ? step : -step)));
      }}
    >
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <View className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
      </View>
      <View
        className="absolute items-center justify-center rounded-full bg-primary"
        style={{ left: knobLeft, width: KNOB_SIZE, height: KNOB_SIZE }}
      >
        <View className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
      </View>
    </View>
  );
}

export { Slider, KNOB_SIZE };
export type { SliderProps };
