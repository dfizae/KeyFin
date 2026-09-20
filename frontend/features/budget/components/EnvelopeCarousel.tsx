import { Portal } from "@rn-primitives/portal";
import { useFocusEffect } from "expo-router";
import * as React from "react";
import { Pressable, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { FillBar } from "@/components/ui/fill-bar";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { envelopeIcon, envelopeShortName, envelopeTone } from "@/features/budget/catalog";
import { envelopeHealth, usedBarPercent, type BudgetEnvelope, type EnvelopeHealth } from "@/features/budget/model";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * 봉투 카드를 2D 회전판에 얹은 캐러셀 (사용자 결정 2026-09-18).
 * 세로 목록의 "행"은 눌러서 들어간다는 신호가 약했다 — 카드 부채를 돌려 고르고, 고른 봉투의 내용은 위 말풍선이 말해 준다.
 *
 * 원의 중심은 화면 **아래(하단 탭 너머)** 에 있고 카드는 거기서 위로 솟는다. 카드 i 의 각도 = (i − rotation) × 26°(세 장만 보이는 간격),
 * 화면 좌표는 x = sin·R, y = 중심 − cos·R 이며 카드 자체도 같은 각도로 기운다(원근 없는 2D 회전).
 * 오른쪽으로 끌면 판이 시계방향으로 돌고, 손을 떼면 12시 자리에 가장 가까운 카드로 스프링 스냅한다.
 * 방 씬 카메라와 같은 구성(셰어드 값 + 제스처)이라 새 라이브러리를 들이지 않았다.
 *
 * 12시 카드를 누르면 카드 안의 글자가 서서히 사라지고, 빈 카드가 화면 전체로 커진 뒤 상세 화면의 내용이 서서히 나타난다
 * (프로토타입 2026-09-19, Pencil 미반영). 커지는 카드는 루트 Portal 에 그려 하단 탭까지 덮고, 다 덮은 순간 전환 없이 상세로 넘어간 뒤 걷어 낸다.
 * 모션 줄이기가 켜져 있으면 연출 없이 바로 넘어간다.
 */

/** 카드 사이 각도(도). 한 번에 세 장(12시 ± 한 장)만 보이도록 크게 벌렸다 (사용자 결정 2026-09-18) */
const STEP_DEG = 26;
const STEP_RAD = (STEP_DEG * Math.PI) / 180;
/** 회전판 반지름. 클수록 호가 완만해진다 */
const RADIUS = 280;
/** 12시 카드의 위 여백. 세로로 길어진 12시 카드가 잘리지 않을 만큼 둔다 */
const TOP_GAP = 138;

/** 옆 카드(기본) 크기 */
const CARD_WIDTH = 224;
const CARD_HEIGHT = 172;
/** 12시 카드 크기 — 세로로 길게 키워 한 장만 도드라지게 한다 (사용자 결정 2026-09-18) */
const FOCUS_WIDTH = 310;
const FOCUS_HEIGHT = 288;
/** 카드 아랫부분은 잘려서 하단 탭 뒤에서 솟아난 것처럼 보인다 */
const WHEEL_HEIGHT = 262;
/** 세 장만 남기고 그 밖의 카드는 화면 가장자리에서 사라진다(|칸 수| 1.05 → 1.5 사이에서 흐려짐) */
const VISIBLE_FROM = 1.05;
const VISIBLE_TO = 1.5;
/** 원의 중심 y(래퍼 위쪽 기준). 12시 카드의 위가 TOP_GAP 에 오도록 잡는다 */
const CENTER_Y = RADIUS + TOP_GAP + CARD_HEIGHT / 2;

/** 카드 한 장을 넘기는 데 필요한 가로 드래그 거리 */
const DRAG_PER_CARD = 64;
/** 손을 뗀 속도를 몇 초치 이동으로 볼지 — 튕기듯 넘기면 여러 장이 지나간다 */
const FLING_SECONDS = 0.12;
const SNAP_SPRING = { damping: 16, stiffness: 130, mass: 0.6 } as const;
/** 12시에서 멀어진 카드는 조금 흐려진다(원근이 아니라 초점 표시다) */
const MIN_OPACITY = 0.55;
/** 12시 카드는 앞으로 튀어나온 것처럼 떠오른다. 크기는 scale 이 아니라 폭·높이를 키워 글자가 늘어나지 않게 한다 */
const FOCUS_LIFT = 16;

/** 12시 카드의 윗변 y(회전판 기준) */
const FOCUS_CARD_TOP = TOP_GAP + CARD_HEIGHT - FOCUS_HEIGHT - FOCUS_LIFT;
/** 카드 모서리(rounded-3xl). 커지면서 0 이 된다 */
const CARD_RADIUS = 24;
/** 카드 안의 글자가 사라지는 시간 */
const CONTENT_FADE_TIMING = { duration: 200 } as const;
/** 빈 카드가 화면 전체로 커지는 시간 */
const EXPAND_TIMING = { duration: 380, easing: Easing.inOut(Easing.cubic) } as const;
/** 상세 화면이 붙을 틈을 준 뒤 덮개를 걷어 상세 내용을 서서히 드러낸다 */
const REVEAL_DELAY = 80;
const REVEAL_TIMING = { duration: 320 } as const;
const SHEET_PORTAL_NAME = "envelope-open-sheet";

/** 창 기준 사각형(pt) */
type WindowRect = { x: number; y: number; width: number; height: number };

const BAR_CLASS: Record<EnvelopeHealth, string> = {
  good: "bg-positive",
  warning: "bg-warning",
  over: "bg-destructive",
  unset: "bg-muted",
};

/** 남은 금액 문구. 확정 전이면 제안액, 초과면 초과액을 적는다(세로 목록과 같은 규칙) */
function amountText(envelope: BudgetEnvelope, health: EnvelopeHealth): string {
  if (health === "unset" || envelope.remaining === null) return envelope.proposed === null ? "-" : `제안 ${formatKRW(envelope.proposed)}`;
  if (health === "over") return `${formatKRW(envelope.remaining, { sign: "never" })} 초과`;
  return `${formatKRW(envelope.remaining)} 남음`;
}

type EnvelopeCarouselProps = {
  envelopes: readonly BudgetEnvelope[];
  /** 12시 카드(또는 말풍선)를 눌렀을 때 */
  onSelect: (envelopeId: number) => void;
};

function EnvelopeCarousel({ envelopes, onSelect }: EnvelopeCarouselProps) {
  const count = envelopes.length;
  const [width, setWidth] = React.useState(0);
  const [focused, setFocused] = React.useState(0);
  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);
  /** 12시 카드의 글자가 사라진 정도(0 보임 → 1 사라짐) */
  const contentFade = useSharedValue(0);
  /** 빈 카드가 화면 전체로 커진 정도(0 → 1) */
  const expand = useSharedValue(0);
  const sheetOpacity = useSharedValue(1);
  /** 커질 카드의 출발 자리. 있는 동안만 Portal 에 덮개를 그린다 */
  const [sheetFrom, setSheetFrom] = React.useState<WindowRect | null>(null);
  const wheelRef = React.useRef<View>(null);
  const openingRef = React.useRef(false);
  const reducedMotion = useReducedMotion();

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  // 12시 카드가 바뀔 때만 React 상태를 갱신한다(말풍선 내용과 카드 강조에만 쓴다).
  useAnimatedReaction(
    () => Math.round(rotation.value),
    (next, previous) => {
      if (previous !== null && next !== previous) runOnJS(setFocused)(((next % count) + count) % count);
    }
  );

  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(width > 0 && count > 1)
        .onStart(() => {
          startRotation.value = rotation.value;
        })
        .onUpdate((event) => {
          // 오른쪽으로 끌면 카드가 오른쪽으로 흘러간다 = 시계방향
          rotation.value = startRotation.value - event.translationX / DRAG_PER_CARD;
        })
        .onEnd((event) => {
          const target = Math.round(rotation.value - (event.velocityX / DRAG_PER_CARD) * FLING_SECONDS);
          rotation.value = withSpring(target, SNAP_SPRING);
        }),
    [width, count, rotation, startRotation]
  );

  const spinTo = React.useCallback(
    (index: number) => {
      // 지금 자리에서 가장 가까운 쪽으로 돈다(마지막 → 처음이면 뒤로 한 칸).
      const current = Math.round(rotation.value);
      const half = Math.floor(count / 2);
      const diff = ((index - (((current % count) + count) % count) + count + half) % count) - half;
      rotation.value = withSpring(current + diff, SNAP_SPRING);
    },
    [count, rotation]
  );

  // 상세에서 돌아오면 카드를 원래대로 돌려 둔다.
  useFocusEffect(
    React.useCallback(() => {
      openingRef.current = false;
      contentFade.value = 0;
      expand.value = 0;
      sheetOpacity.value = 1;
      setSheetFrom(null);
    }, [contentFade, expand, sheetOpacity])
  );

  /** 카드가 화면을 다 덮은 순간 상세로 넘어가고, 덮개를 서서히 걷어 상세 내용을 드러낸다 */
  const enterDetail = React.useCallback(
    (envelopeId: number) => {
      onSelect(envelopeId);
      sheetOpacity.value = withDelay(
        REVEAL_DELAY,
        withTiming(0, REVEAL_TIMING, () => {
          runOnJS(setSheetFrom)(null);
        })
      );
    },
    [onSelect, sheetOpacity]
  );

  /** 글자 사라짐 → 카드가 화면으로 커짐 → 상세. 진행 중의 중복 탭은 무시한다 */
  const openEnvelope = React.useCallback(
    (envelopeId: number) => {
      if (openingRef.current) return;
      openingRef.current = true;
      if (reducedMotion) {
        onSelect(envelopeId);
        return;
      }
      const wheel = wheelRef.current;
      // 자리를 잴 수 없으면 덮개를 그릴 수 없다 — 연출 없이 넘어간다
      if (wheel === null) {
        onSelect(envelopeId);
        return;
      }
      wheel.measureInWindow((wheelX, wheelY) => {
        setSheetFrom({
          x: wheelX + width / 2 - FOCUS_WIDTH / 2,
          y: wheelY + FOCUS_CARD_TOP,
          width: FOCUS_WIDTH,
          // 카드 아랫부분은 회전판에 잘려 있으므로 보이는 만큼에서 출발한다
          height: WHEEL_HEIGHT - FOCUS_CARD_TOP,
        });
      });
      contentFade.value = withTiming(1, CONTENT_FADE_TIMING, (faded) => {
        if (!faded) return;
        expand.value = withTiming(1, EXPAND_TIMING, (expanded) => {
          if (expanded) runOnJS(enterDetail)(envelopeId);
        });
      });
    },
    [contentFade, expand, width, reducedMotion, onSelect, enterDetail]
  );

  const selected = envelopes[focused];

  return (
    <View className="gap-1">
      {selected === undefined ? null : <EnvelopeBubble envelope={selected} onPress={() => openEnvelope(selected.envelopeId)} />}

      {/* 위치를 재는 ref 는 제스처 바깥에 둔다 — GestureDetector 가 바로 아래 자식의 ref 를 자기 것으로 바꿔 끼운다 */}
      <View ref={wheelRef} collapsable={false}>
        <GestureDetector gesture={gesture}>
          <View className="w-full overflow-hidden" style={{ height: WHEEL_HEIGHT }} onLayout={handleLayout}>
            {width > 0
              ? envelopes.map((envelope, index) => (
                  <EnvelopeCard
                    key={envelope.envelopeId}
                    envelope={envelope}
                    index={index}
                    count={count}
                    rotation={rotation}
                    contentFade={contentFade}
                    centerX={width / 2}
                    isFocused={focused === index}
                    onPress={() => (focused === index ? openEnvelope(envelope.envelopeId) : spinTo(index))}
                  />
                ))
              : null}
          </View>
        </GestureDetector>
      </View>

      {sheetFrom === null ? null : (
        <Portal name={SHEET_PORTAL_NAME}>
          <EnvelopeSheet from={sheetFrom} expand={expand} opacity={sheetOpacity} />
        </Portal>
      )}
    </View>
  );
}

type EnvelopeSheetProps = { from: WindowRect; expand: SharedValue<number>; opacity: SharedValue<number> };

/** 눌린 카드가 화면 전체로 커지는 덮개. 카드와 같은 모양(빈 카드)에서 출발한다 */
function EnvelopeSheet({ from, expand, opacity }: EnvelopeSheetProps) {
  const window = useWindowDimensions();
  const style = useAnimatedStyle(() => {
    const t = expand.value;
    return {
      left: from.x * (1 - t),
      top: from.y * (1 - t),
      width: from.width + (window.width - from.width) * t,
      height: from.height + (window.height - from.height) * t,
      borderRadius: CARD_RADIUS * (1 - t),
      // 글자가 다 사라지기 전에는 회전판의 카드가 보이고, 커지기 시작하면 이 덮개가 이어받는다
      opacity: t > 0 ? opacity.value : 0,
    };
  });

  return (
    <View className="pointer-events-none absolute inset-0" accessible={false}>
      <Animated.View className="absolute bg-card" style={style} />
    </View>
  );
}

/** 12시 카드가 가리키는 봉투의 내용. 꼬리가 카드 쪽(아래)을 향한다. */
function EnvelopeBubble({ envelope, onPress }: { envelope: BudgetEnvelope; onPress: () => void }) {
  const health = envelopeHealth(envelope);
  const used = usedBarPercent(envelope.remainingRate);
  const text = amountText(envelope, health);
  const tone = envelopeTone(envelope.envelopeId);

  return (
    <View className="items-center px-6">
      <Pressable
        className="w-full cursor-pointer gap-3 rounded-2xl bg-card p-5 shadow shadow-black/10 hover:shadow-lg active:opacity-80 dark:border dark:border-border dark:shadow-none"
        accessibilityRole="button"
        accessibilityLabel={`${envelope.name} ${text}`}
        accessibilityHint="봉투 상세를 엽니다"
        onPress={onPress}
      >
        <View className="flex-row items-center gap-2.5">
          <View className={cn("h-8 w-8 items-center justify-center rounded-lg", tone.tile)}>
            <Icon as={envelopeIcon(envelope.envelopeId)} size={18} className={tone.icon} />
          </View>
          <Text className="text-label text-foreground">{envelope.name}</Text>
        </View>

        <Text
          className={cn(
            "text-amount-md tabular-nums",
            health === "over" ? "text-destructive" : health === "unset" ? "text-card-foreground" : "text-foreground"
          )}
        >
          {text}
        </Text>

        <FillBar percent={used} fillClassName={BAR_CLASS[health]} className="h-1.5" fillDelay={0} />
        {envelope.confirmed === null ? null : (
          <Text className="text-caption tabular-nums text-card-foreground">
            {formatKRW(envelope.spent ?? "0")} / {formatKRW(envelope.confirmed)}
          </Text>
        )}
      </Pressable>

      {/* 말풍선 꼬리 — 카드 쪽을 가리킨다 */}
      <View className="-mt-1.5 h-3 w-3 rotate-45 rounded-sm bg-card dark:border-b dark:border-r dark:border-border" accessible={false} />
    </View>
  );
}

type EnvelopeCardProps = {
  envelope: BudgetEnvelope;
  index: number;
  count: number;
  rotation: SharedValue<number>;
  contentFade: SharedValue<number>;
  centerX: number;
  isFocused: boolean;
  onPress: () => void;
};

function EnvelopeCard({ envelope, index, count, rotation, contentFade, centerX, isFocused, onPress }: EnvelopeCardProps) {
  const health = envelopeHealth(envelope);
  const tone = envelopeTone(envelope.envelopeId);
  const text = amountText(envelope, health);

  const style = useAnimatedStyle(() => {
    // 가장 가까운 쪽으로 감아 항상 부채 안에 들어오게 한다(멀리 돌아가는 카드가 화면을 가로지르지 않게).
    const half = count / 2;
    const offset = (((index - rotation.value + half) % count) + count) % count - half;
    const angle = offset * STEP_RAD;
    const centerYOfCard = CENTER_Y - Math.cos(angle) * RADIUS;
    const distance = Math.abs(offset);
    const focus = Math.max(0, 1 - distance / half);
    const visible = 1 - Math.min(1, Math.max(0, (distance - VISIBLE_FROM) / (VISIBLE_TO - VISIBLE_FROM)));
    // 12시에 가까울수록 카드가 커지고 떠오르고 앞에 놓인다. 옆 카드(|칸| 1 이상)는 기본 크기 그대로다.
    // 늘어나는 것은 scale 이 아니라 실제 폭·높이라 글자와 아이콘이 찌그러지지 않는다. 아랫변을 고정해 위로 자란다.
    const pop = Math.max(0, 1 - distance);
    const cardWidth = CARD_WIDTH + (FOCUS_WIDTH - CARD_WIDTH) * pop;
    const cardHeight = CARD_HEIGHT + (FOCUS_HEIGHT - CARD_HEIGHT) * pop;
    const bottomY = centerYOfCard + CARD_HEIGHT / 2;
    return {
      width: cardWidth,
      height: cardHeight,
      transform: [
        { translateX: Math.sin(angle) * RADIUS - (cardWidth - CARD_WIDTH) / 2 },
        { translateY: bottomY - cardHeight - FOCUS_LIFT * pop },
        { rotate: `${offset * STEP_DEG}deg` },
      ],
      opacity: (MIN_OPACITY + (1 - MIN_OPACITY) * focus) * visible,
      zIndex: Math.round(pop * 100),
    };
  });
  const contentStyle = useAnimatedStyle(() => {
    const half = count / 2;
    const offset = (((index - rotation.value + half) % count) + count) % count - half;
    const pop = Math.max(0, 1 - Math.abs(offset));
    const bottomY = CENTER_Y - Math.cos(offset * STEP_RAD) * RADIUS + CARD_HEIGHT / 2;
    return {
      // 카드 아랫부분은 회전판에 잘려 안 보인다 — 그만큼을 아래 여백으로 빼야 내용이 **보이는 부분**의 가운데에 온다.
      paddingBottom: Math.max(0, bottomY - FOCUS_LIFT * pop - WHEEL_HEIGHT),
      // 눌린 12시 카드만 글자가 사라진다. 카드 바탕은 남아 그대로 커진다.
      opacity: isFocused ? 1 - contentFade.value : 1,
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: centerX - CARD_WIDTH / 2 }, style]}>
      <Pressable
        className={cn(
          "h-full cursor-pointer rounded-3xl bg-card px-3 shadow shadow-black/10 dark:border dark:border-border dark:shadow-none",
          isFocused ? "border-2 border-primary shadow-lg hover:shadow-xl" : "active:opacity-80"
        )}
        accessibilityRole="button"
        accessibilityLabel={`${envelope.name} ${text}`}
        accessibilityHint={isFocused ? "봉투 상세를 엽니다" : "이 봉투를 위로 돌립니다"}
        onPress={onPress}
      >
        <Animated.View className="flex-1 items-center justify-center gap-2.5" style={contentStyle}>
          <View className={cn("items-center justify-center rounded-2xl", tone.tile, isFocused ? "h-16 w-16" : "h-11 w-11")}>
            <Icon as={envelopeIcon(envelope.envelopeId)} size={isFocused ? 32 : 22} className={tone.icon} />
          </View>
          <Text
            className={cn("text-center", isFocused ? "text-label text-foreground" : "text-caption text-card-foreground")}
            numberOfLines={1}
          >
            {envelopeShortName(envelope.envelopeId, envelope.name)}
          </Text>
          {isFocused ? (
            <Text
              className={cn(
                "text-center text-amount-sm tabular-nums",
                health === "over" ? "text-destructive" : health === "unset" ? "text-card-foreground" : "text-foreground"
              )}
              numberOfLines={1}
            >
              {text}
            </Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export { EnvelopeCarousel };
export type { EnvelopeCarouselProps };
