import { Redirect, useFocusEffect } from "expo-router";
import { Bell, Coins, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { selectUserName, useAuthStore } from "@/features/auth/store";
import { needsConfirmation, useCurrentBudget } from "@/features/budget/api/queries";
import { PROPOSAL_FROM_HOME_HREF } from "@/features/budget/components/BudgetProposalScreen";
import { AttendanceToast } from "@/features/home/components/AttendanceToast";
import { CharacterRoom } from "@/features/home/components/CharacterRoom";
import { HomeCalendar, HomeCalendarPanel } from "@/features/home/components/HomeCalendar";
import { HomeCoach } from "@/features/home/components/HomeCoach";
import { HomeBoardPanel, HomeWallBoard } from "@/features/home/components/HomeWallBoard";
import { useCheckAttendance, useRoom } from "@/features/room/api/queries";
import { RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { currentMonthKey } from "@/lib/date";
import { formatKRW } from "@/lib/money";

/** 벽 오브젝트의 패널(예산 시트·캘린더 팝오버)은 한 번에 하나만 연다. */
type RoomPanel = "board" | "calendar" | null;

function HomeScreen() {
  const room = useRoom();
  const month = currentMonthKey();
  const budget = useCurrentBudget();
  const attendance = useHomeAttendance(room.isSuccess && !room.data.checkedInToday);
  const [panel, setPanel] = React.useState<RoomPanel>(null);
  // 확대 중에는 방을 끌어 움직이므로 홈의 세로 스크롤을 잠근다.
  const [roomZoomed, setRoomZoomed] = React.useState(false);

  // 이번 주기 예산이 확정 전이면 확정 화면으로 보낸다(노션 예산·잔액 조회, 사용자 결정 2026-09-12). 방·보드가 확정 예산을 기준으로 동작한다.
  if (needsConfirmation(budget)) return <Redirect href={PROPOSAL_FROM_HOME_HREF} />;

  // 방이 홈의 주인공이다(사용자 결정 2026-09-15): 화면 폭 가득, 아래 예산 카드 없음. 예산은 벽의 리스트를 탭해 시트로 본다.
  // 작은 화면에서 방이 다 안 들어갈 때만 스크롤된다.
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="flex-grow justify-center pb-6" scrollEnabled={!roomZoomed}>
      {room.isPending ? <HomeSkeleton /> : null}
      {room.isError ? (
        <View className="flex-1 px-6 pt-6">
          <EmptyState
            icon={WifiOff}
            title="방 정보를 불러오지 못했어요"
            description="연결 상태를 확인한 뒤 다시 시도해 주세요."
            action={{ label: "다시 시도", onPress: () => room.refetch(), disabled: room.isFetching }}
          />
        </View>
      ) : null}
      {room.isSuccess ? (
        <>
          <HomeHeader coinBalance={room.data.coinBalance} />
          <View className="relative">
            <CharacterRoom
              locked={panel !== null}
              onZoomedChange={setRoomZoomed}
              sceneObjects={(width) => (
                <>
                  <HomeWallBoard width={width} budget={budget} onOpen={() => setPanel("board")} />
                  <HomeCalendar width={width} month={month} onOpen={() => setPanel("calendar")} />
                </>
              )}
              panels={(width) => (
                <>
                  {panel === "calendar" ? <HomeCalendarPanel width={width} month={month} onClose={() => setPanel(null)} /> : null}
                  <HomeCoach width={width} />
                  {panel === null ? <RoomEditorOverlay /> : null}
                </>
              )}
            />
            {attendance.isSuccess && attendance.data.granted > 0 ? <AttendanceToast granted={attendance.data.granted} /> : null}
          </View>
          <HomeBoardPanel visible={panel === "board"} budget={budget} onClose={() => setPanel(null)} />
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * 홈에 들어올 때 당일 첫 출석이면 POST /attendance 를 한 번 부른다 (FR-GAM-03).
 * 서버 checkedToday 가 1차 방어, 세션 중 재진입은 ref 가 막는다. 실패는 조용히 두지 않고 mutation error 로 남기되 화면은 막지 않는다. (TBD: 실패 문구)
 */
function useHomeAttendance(shouldCheckIn: boolean) {
  const attendance = useCheckAttendance();
  const requested = React.useRef(false);
  const { mutate: checkIn } = attendance;

  useFocusEffect(
    React.useCallback(() => {
      if (!shouldCheckIn || requested.current) return;
      requested.current = true;
      checkIn();
    }, [shouldCheckIn, checkIn])
  );

  return attendance;
}

type HomeHeaderProps = {
  coinBalance: number;
};

// Pencil home/p0 (EWfx2) HomeHeader: padding [16,24] · space_between · 좌측 caption+h2 · 우측 코인 배지 + 알림 벨.
function HomeHeader({ coinBalance }: HomeHeaderProps) {
  const userName = useAuthStore(selectUserName);
  const greeting = userName ? `${userName}님, 안녕하세요!` : "안녕하세요!";

  return (
    <View className="flex-row items-center justify-between bg-background px-6 py-4">
      <View className="gap-1">
        <Text className="text-caption text-card-foreground">환영합니다</Text>
        <Text className="text-h2 text-foreground" accessibilityRole="header">
          {greeting}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <CoinBadge balance={coinBalance} />
        <NotificationButton />
      </View>
    </View>
  );
}

// Pencil CoinBadge (DsQOx): bg-accent 알약 · 16pt 노란 원(#F5D547 — 토큰 없음, warning 으로 대체) · 14/500 숫자.
function CoinBadge({ balance }: { balance: number }) {
  const text = formatKRW(String(balance), { unit: false });

  return (
    <View className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-1" accessible accessibilityLabel={`코인 ${text}개`}>
      <View className="h-4 w-4 items-center justify-center rounded-full bg-warning" accessible={false}>
        <Icon as={Coins} size={10} className="text-foreground" />
      </View>
      <Text className="text-label tabular-nums text-foreground">{text}</Text>
    </View>
  );
}

// Pencil NotificationBtn (q6hfgQ): 40pt 원형 bg-accent + lucide bell. 알림함(PAGE-28)은 P1 이라 진입은 아직 없고 미읽음 배지도 P1 API 다.
function NotificationButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="알림"
      accessibilityState={{ disabled: true }}
      disabled
      hitSlop={8}
      className="h-10 w-10 items-center justify-center rounded-full bg-accent"
    >
      <Icon as={Bell} size={20} className="text-foreground" />
    </Pressable>
  );
}

const ROOM_SKELETON_ASPECT_RATIO = 327 / 404;

function HomeSkeleton() {
  return (
    <View className="flex-1" accessibilityLabel="불러오는 중" accessible>
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-48" />
        </View>
        <Skeleton className="h-10 w-10 rounded-full" />
      </View>
      <Skeleton className="w-full rounded-xl" style={{ aspectRatio: ROOM_SKELETON_ASPECT_RATIO }} />
    </View>
  );
}

export { HomeScreen };
