import { useRouter } from "expo-router";
import * as React from "react";
import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";
import { CHARACTER_CELEBRATE } from "@/features/room/assets";
import { useRoom } from "@/features/room/api/queries";
import { cn } from "@/lib/utils";

const HOME_ROUTE = "/";

/** 방 데이터가 금방 와도 연출이 보이도록 최소한 이만큼은 머문다 */
const MIN_VISIBLE_MS = 1_500;
const DOT_INTERVAL_MS = 400;
const DOTS = [0, 1, 2];

/** 시안(sla4v)의 원형 200 · 캐릭터 160. 4px 스케일 밖 값이라 크기만 style 로 준다 */
const CIRCLE_STYLE = { width: 200, height: 200 } as const;
const CHARACTER_STYLE = { width: 160, height: 160 } as const;

// Pencil character-moving-in (sla4v). GET /room 을 미리 받아 두고 홈으로 넘긴다 (PAGE-08).
function MovingInScreen() {
  const router = useRouter();
  const room = useRoom();
  const [waited, setWaited] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setWaited(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // 방을 못 받아도 홈이 스스로 오류·재시도를 보여주므로 여기서 붙잡지 않는다.
  const settled = !room.isPending;

  React.useEffect(() => {
    if (waited && settled) router.replace(HOME_ROUTE);
  }, [waited, settled, router]);

  return (
    <View className="flex-1 items-center justify-center gap-8 bg-background px-6" accessibilityLiveRegion="polite">
      <View className="items-center justify-center overflow-hidden rounded-full bg-muted" style={CIRCLE_STYLE}>
        <Image source={CHARACTER_CELEBRATE} style={CHARACTER_STYLE} resizeMode="contain" accessibilityRole="image" />
      </View>

      <View className="items-center gap-2">
        <Text className="text-h1 text-foreground" accessibilityRole="header">
          캐릭터가 입주하고 있어요
        </Text>
        <Text className="text-center text-body-sm text-muted-foreground">
          잠시만 기다려 주세요.{"\n"}방을 준비하고 있어요.
        </Text>
      </View>

      <LoadingDots />
    </View>
  );
}

/** 점 세 개가 차례로 켜지는 인디케이터. 화면이 곧 사라지므로 애니메이션 라이브러리 없이 간격만 돌린다. */
function LoadingDots() {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => setActive((prev) => (prev + 1) % DOTS.length), DOT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <View className="flex-row gap-2" accessible accessibilityLabel="불러오는 중">
      {DOTS.map((dot) => (
        <View key={dot} className={cn("h-2.5 w-2.5 rounded-full", dot === active ? "bg-primary" : "bg-border")} />
      ))}
    </View>
  );
}

export { MovingInScreen, MIN_VISIBLE_MS };
