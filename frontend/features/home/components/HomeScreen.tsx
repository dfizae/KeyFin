import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Bell, Coins, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Screen, useTopInset } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { needsConfirmation, useCurrentBudget } from "@/features/budget/api/queries";
import { PROPOSAL_FROM_HOME_HREF } from "@/features/budget/components/BudgetProposalScreen";
import { AttendanceToast } from "@/features/home/components/AttendanceToast";
import { CharacterRoom } from "@/features/home/components/CharacterRoom";
import { HomeCalendar } from "@/features/home/components/HomeCalendar";
import { HomeCoach } from "@/features/home/components/HomeCoach";
import { HomeBoardPanel, HomeWallBoard } from "@/features/home/components/HomeWallBoard";
import { ROOM_GUIDE_STEPS, useRoomGuide } from "@/features/home/useRoomGuide";
import { useCheckAttendance, useRoom } from "@/features/room/api/queries";
import { RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { coverSceneWidth } from "@/features/room/model";
import { useRoomLayoutSync } from "@/features/room/useRoomLayout";
import { currentMonthKey } from "@/lib/date";
import { formatKRW } from "@/lib/money";

/** 벽 오브젝트가 여는 패널. 지금은 예산 보드 시트 하나뿐이다 — 캘린더는 팝오버를 거치지 않고 결제 캘린더 화면으로 간다(2026-09-18). */
type RoomPanel = "board" | null;

/** 벽 캘린더를 누르면 바로 여는 화면 (PAGE-24). 중간 팝오버를 거치지 않는다 (사용자 결정 2026-09-18) */
const PAYMENT_CALENDAR_ROUTE = "/payment/calendar";

/** 상태바 아래로 사이드 버튼을 내리는 간격 */
const SIDE_ACTION_GAP = 8;
/** 오류 화면은 헤더가 없으니 상태바만큼 내려 준다 */
const ERROR_TOP_GAP = 24;

function HomeScreen() {
  const router = useRouter();
  const room = useRoom();
  useRoomLayoutSync();
  const topInset = useTopInset();
  const month = currentMonthKey();
  const budget = useCurrentBudget();
  const attendance = useHomeAttendance(room.isSuccess && !room.data.checkedInToday);
  const [panel, setPanel] = React.useState<RoomPanel>(null);
  const [box, setBox] = React.useState({ width: 0, height: 0 });
  const guide = useRoomGuide(room.isSuccess);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width: Math.round(width), height: Math.round(height) });
  }, []);

  // 이번 주기 예산이 확정 전이면 확정 화면으로 보낸다(노션 예산·잔액 조회, 사용자 결정 2026-09-12). 방·보드가 확정 예산을 기준으로 동작한다.
  if (needsConfirmation(budget)) return <Redirect href={PROPOSAL_FROM_HOME_HREF} />;

  // 방이 홈의 주인공이다(사용자 결정 2026-09-15). 2026-09-18 코치 피드백 반영: **헤더를 없애고 하단 탭바를 뺀 화면 전체를 방으로 채운다.**
  // 화면은 씬(327:404)보다 세로로 길기 때문에 폭을 넘치게 키워(coverSceneWidth) 가운데를 보여 주고 좌우는 잘라 낸다.
  // 인사말은 버렸고 코인·알림만 방 위에 뜨는 사이드 버튼으로 남는다. 방이 화면을 꽉 채우니 세로 스크롤도 없다.
  const roomWidth = box.width > 0 && box.height > 0 ? coverSceneWidth(box.width, box.height) : 0;
  // 방이 화면보다 넓으면 씬 x 0 이 화면 밖이다. 코치는 카메라를 따라가지 않는 패널이라 넘친 절반만큼 밀어 화면 안에 둔다.
  const coachOffsetX = Math.max(0, (roomWidth - box.width) / 2);

  // 안내 중에 에셋을 직접 누르면 목적을 이룬 것이라 안내를 끝낸다
  const openBoard = () => {
    guide.finish();
    setPanel("board");
  };
  const openCalendar = () => {
    guide.finish();
    router.push(PAYMENT_CALENDAR_ROUTE);
  };
  const coachGuide = guide.step
    ? {
        message: guide.step.message,
        progress: `${guide.step.index + 1}/${ROOM_GUIDE_STEPS.length}`,
        isLast: guide.step.isLast,
        onNext: guide.next,
        onSkip: guide.finish,
      }
    : null;

  return (
    <Screen>
      <View className="flex-1 items-center justify-center overflow-hidden" onLayout={handleLayout}>
        {room.isPending ? <Skeleton className="h-full w-full" accessibilityLabel="불러오는 중" /> : null}
        {room.isError ? (
          <View className="w-full flex-1 px-6" style={{ paddingTop: topInset + ERROR_TOP_GAP }}>
            <EmptyState
              icon={WifiOff}
              title="방 정보를 불러오지 못했어요"
              description="연결 상태를 확인한 뒤 다시 시도해 주세요."
              action={{ label: "다시 시도", onPress: () => room.refetch(), disabled: room.isFetching }}
            />
          </View>
        ) : null}
        {room.isSuccess ? (
          <CharacterRoom
            width={roomWidth > 0 ? roomWidth : undefined}
            viewport={roomWidth > 0 ? box : undefined}
            locked={panel !== null}
            sceneObjects={(width) => (
              <>
                <HomeWallBoard width={width} budget={budget} onOpen={openBoard} highlighted={guide.step?.target === "board"} />
                <HomeCalendar width={width} month={month} onOpen={openCalendar} highlighted={guide.step?.target === "calendar"} />
              </>
            )}
            panels={(width) => (
              <>
                <HomeCoach width={width} offsetX={coachOffsetX} guide={coachGuide} />
              </>
            )}
          />
        ) : null}
        {room.isSuccess && attendance.isSuccess && attendance.data.granted > 0 ? (
          <AttendanceToast granted={attendance.data.granted} />
        ) : null}
      </View>
      <HomeBoardPanel visible={panel === "board"} budget={budget} onClose={() => setPanel(null)} />
      {room.isSuccess ? <HomeSideActions coinBalance={room.data.coinBalance} showEdit={panel === null} /> : null}
    </Screen>
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

/**
 * 방 위에 떠 있는 사이드 버튼 줄. 왼쪽에 코인·알림을 세로로, 오른쪽에 꾸미기 버튼을 둔다 (2026-09-18 코치 피드백).
 * 방은 화면보다 넓을 수 있어(cover 맞춤) 방 기준이 아니라 **화면 기준**으로 놓는다 — 방 레이어에 두면 오른쪽 버튼이 화면 밖으로 나간다.
 */
function HomeSideActions({ coinBalance, showEdit }: { coinBalance: number; showEdit: boolean }) {
  const topInset = useTopInset();

  return (
    <View
      className="absolute left-0 right-0 flex-row items-start justify-between px-4"
      style={{ top: topInset + SIDE_ACTION_GAP }}
      pointerEvents="box-none"
    >
      <View className="items-start gap-2" pointerEvents="box-none">
        <CoinBadge balance={coinBalance} />
        <NotificationButton />
      </View>
      {showEdit ? <RoomEditorOverlay /> : null}
    </View>
  );
}

const COIN_HISTORY_ROUTE = "/coin";

// Pencil CoinBadge (DsQOx): bg-accent 알약 · 노란 원 + 숫자. 누르면 코인 이력(PAGE-30)으로 간다.
// 방 그림 위에 떠 있어 그림자로 면을 띄우고, 알림 버튼과 같은 40pt 높이로 맞췄다 (2026-09-18).
function CoinBadge({ balance }: { balance: number }) {
  const router = useRouter();
  const text = formatKRW(String(balance), { unit: false });

  return (
    <Pressable
      className="h-10 flex-row items-center gap-1.5 rounded-full bg-accent px-3 shadow shadow-black/10 active:opacity-70 dark:border dark:border-border dark:shadow-none"
      accessibilityRole="button"
      accessibilityLabel={`코인 ${text}개`}
      accessibilityHint="코인 이력을 엽니다"
      hitSlop={8}
      onPress={() => router.push(COIN_HISTORY_ROUTE)}
    >
      <View className="h-5 w-5 items-center justify-center rounded-full bg-warning" accessible={false}>
        <Icon as={Coins} size={12} className="text-foreground" />
      </View>
      <Text className="text-label tabular-nums text-foreground">{text}</Text>
    </Pressable>
  );
}

const NOTIFICATION_ROUTE = "/notification";

// Pencil NotificationBtn (q6hfgQ): 40pt 원형 bg-accent + lucide bell. 누르면 알림함(PAGE-28)으로 간다.
function NotificationButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="알림"
      accessibilityHint="알림함을 엽니다"
      hitSlop={8}
      className="h-10 w-10 items-center justify-center rounded-full bg-accent shadow shadow-black/10 active:opacity-70 dark:border dark:border-border dark:shadow-none"
      onPress={() => router.push(NOTIFICATION_ROUTE)}
    >
      <Icon as={Bell} size={20} className="text-foreground" />
    </Pressable>
  );
}

export { HomeScreen };
