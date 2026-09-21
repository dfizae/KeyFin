import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { Bell, Coins, Shirt, Store, WifiOff } from "lucide-react-native";
import * as React from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import type { LucideIcon } from "lucide-react-native";

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
import { AVATAR_SCENE } from "@/features/home/components/CoachBubble";
import { RoomGuideOverlay } from "@/features/home/components/RoomGuideOverlay";
import { ROOM_GUIDE_STEPS, useRoomGuide, type GuideTargetId } from "@/features/home/useRoomGuide";
import { roomKeys, useCheckAttendance, useRoom } from "@/features/room/api/queries";
import { RoomEditorOverlay } from "@/features/room/components/RoomEditorOverlay";
import { coverSceneWidth, getCanvasSize, getSceneScale, type SceneRect } from "@/features/room/model";
import { getWallItemRect } from "@/features/room/scene";
import { selectPlacements, useRoomStore } from "@/features/room/store";
import { useRoomLayoutSync } from "@/features/room/useRoomLayout";
import { useRefetchStaleOnFocus } from "@/hooks/use-refetch-stale-on-focus";
import { currentMonthKey } from "@/lib/date";
import { formatKRW } from "@/lib/money";
import { cn } from "@/lib/utils";

/** 벽 오브젝트가 여는 패널. 지금은 예산 보드 시트 하나뿐이다 — 캘린더는 팝오버를 거치지 않고 결제 캘린더 화면으로 간다(2026-09-18). */
type RoomPanel = "board" | null;

/** 벽 캘린더를 누르면 바로 여는 화면 (PAGE-24). 중간 팝오버를 거치지 않는다 (사용자 결정 2026-09-18) */
const PAYMENT_CALENDAR_ROUTE = "/payment/calendar";

/** 상태바 아래로 사이드 버튼을 내리는 간격 */
/** 방이 들어가는 영역. 테스트가 이 영역의 크기를 알려 줄 때 쓴다 */
export const HOME_ROOM_BOX_TEST_ID = "home-room-box";

const SIDE_ACTION_GAP = 8;
/** 오류 화면은 헤더가 없으니 상태바만큼 내려 준다 */
const ERROR_TOP_GAP = 24;

function HomeScreen() {
  const router = useRouter();
  const room = useRoom();
  // 코인 수는 방 홈의 값이다. 코인 이력·상점에서 돌아왔을 때 옛 잔액이 남지 않게 한다
  useRefetchStaleOnFocus(roomKeys.all);
  useRoomLayoutSync();
  const topInset = useTopInset();
  const month = currentMonthKey();
  const budget = useCurrentBudget();
  const attendance = useHomeAttendance(room.isSuccess && !room.data.checkedInToday);
  const [panel, setPanel] = React.useState<RoomPanel>(null);
  const [box, setBox] = React.useState({ width: 0, height: 0 });
  const guide = useRoomGuide(room.isSuccess);
  const placements = useRoomStore(selectPlacements);
  // 방 밖(화면)에 떠 있는 버튼은 씬 좌표가 없어 실제로 그려진 자리를 재 둔다
  const [buttonRects, setButtonRects] = React.useState<Partial<Record<GuideTargetId, SceneRect>>>({});
  const measureButton = React.useCallback((id: GuideTargetId, rect: SceneRect) => {
    setButtonRects((current) => (sameRect(current[id], rect) ? current : { ...current, [id]: rect }));
  }, []);

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

  // 방 레이어는 화면 가운데에 놓이고 넘치는 만큼 잘리므로, 씬 좌표를 화면 좌표로 옮길 때 그 절반을 빼 준다.
  const roomScale = roomWidth > 0 ? getSceneScale(roomWidth) : 0;
  const offsetY = roomWidth > 0 ? Math.max(0, (getCanvasSize(roomWidth).height - box.height) / 2) : 0;
  const sceneToScreen = (rect: SceneRect): SceneRect => ({
    x: rect.x * roomScale - coachOffsetX,
    y: rect.y * roomScale - offsetY,
    width: rect.width * roomScale,
    height: rect.height * roomScale,
  });
  // 코치는 패널 레이어에서 이미 coachOffsetX 만큼 밀어 두므로 화면 x 가 그대로 씬 x 다
  const coachScreenRect = (): SceneRect => ({
    x: AVATAR_SCENE.x * roomScale,
    y: AVATAR_SCENE.y * roomScale - offsetY,
    width: AVATAR_SCENE.size * roomScale,
    height: AVATAR_SCENE.size * roomScale,
  });
  const guideRect = (target: GuideTargetId): SceneRect | null => {
    if (roomScale === 0) return null;
    if (target === "coach") return coachScreenRect();
    if (target === "board" || target === "calendar") {
      const rect = getWallItemRect(placements, target);
      return rect === null ? null : sceneToScreen(rect);
    }
    return buttonRects[target] ?? null;
  };

  // 안내 중에 에셋을 직접 누르면 목적을 이룬 것이라 안내를 끝낸다
  const openBoard = () => {
    guide.finish();
    setPanel("board");
  };
  const openCalendar = () => {
    guide.finish();
    router.push(PAYMENT_CALENDAR_ROUTE);
  };

  return (
    <Screen>
      <View className="flex-1 items-center justify-center overflow-hidden" onLayout={handleLayout} testID={HOME_ROOM_BOX_TEST_ID}>
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
                <HomeWallBoard width={width} budget={budget} onOpen={openBoard} />
                <HomeCalendar width={width} month={month} onOpen={openCalendar} />
              </>
            )}
            panels={(width) => (
              <>
                <HomeCoach width={width} offsetX={coachOffsetX} />
              </>
            )}
          />
        ) : null}
        {room.isSuccess && attendance.isSuccess && attendance.data.granted > 0 ? (
          <AttendanceToast granted={attendance.data.granted} />
        ) : null}
      </View>
      <HomeBoardPanel visible={panel === "board"} budget={budget} onClose={() => setPanel(null)} />
      {room.isSuccess ? (
        <HomeSideActions coinBalance={room.data.coinBalance} showEdit={panel === null} onMeasure={measureButton} />
      ) : null}
      {/* 안내 덮개는 방과 사이드 버튼을 모두 덮어야 해서 맨 위에 둔다 */}
      {guide.step ? (
        <RoomGuideOverlay
          rect={guideRect(guide.step.target)}
          message={guide.step.message}
          progress={`${guide.step.index + 1}/${ROOM_GUIDE_STEPS.length}`}
          isLast={guide.step.isLast}
          onNext={guide.next}
          onSkip={guide.finish}
        />
      ) : null}
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
 * 방 위에 떠 있는 사이드 버튼 줄. 왼쪽에 코인·알림·상점·옷장을 세로로, 오른쪽에 꾸미기 버튼을 둔다 (2026-09-18 코치 피드백, 상점·옷장은 2026-09-20 사용자 요청).
 * 첫 진입 안내 중에는 방과 같이 물러나도록 흐려 둔다 — 방만 어둑해지고 버튼만 밝으면 덮개가 따로 놀아 보인다 (2026-09-20).
 * 방은 화면보다 넓을 수 있어(cover 맞춤) 방 기준이 아니라 **화면 기준**으로 놓는다 — 방 레이어에 두면 오른쪽 버튼이 화면 밖으로 나간다.
 */
function HomeSideActions({
  coinBalance,
  showEdit,
  onMeasure,
}: {
  coinBalance: number;
  showEdit: boolean;
  onMeasure: (id: GuideTargetId, rect: SceneRect) => void;
}) {
  const topInset = useTopInset();

  return (
    <View
      className="absolute left-0 right-0 flex-row items-start justify-between px-4"
      style={{ top: topInset + SIDE_ACTION_GAP }}
      pointerEvents="box-none"
    >
      <View className="items-start gap-2" pointerEvents="box-none">
        <CoinBadge balance={coinBalance} />
        <NotificationButton onMeasure={onMeasure} />
        <RoomActionButton
          icon={Store}
          label="상점"
          hint="상점을 엽니다"
          iconClassName="text-primary"
          route={SHOP_ROUTE}
          guideId="shop"
          onMeasure={onMeasure}
        />
        <RoomActionButton
          icon={Shirt}
          label="옷장"
          hint="캐릭터 옷을 갈아입습니다"
          iconClassName="text-positive"
          route={WARDROBE_ROUTE}
          guideId="wardrobe"
          onMeasure={onMeasure}
        />
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
const SHOP_ROUTE = "/shop";
const WARDROBE_ROUTE = "/character/wardrobe";

type RoomActionButtonProps = {
  icon: LucideIcon;
  /** 스크린리더가 읽는 이름 */
  label: string;
  hint: string;
  /** 아이콘 색. 봉투처럼 버튼마다 다른 색을 줘 한눈에 갈린다 (사용자 요청 2026-09-20) */
  iconClassName: string;
  route: string;
  /** 첫 진입 안내가 가리킬 대상 id */
  guideId: GuideTargetId;
  onMeasure: (id: GuideTargetId, rect: SceneRect) => void;
};

// Pencil NotificationBtn (q6hfgQ): 40pt 원형 bg-accent + lucide 아이콘. 알림·상점·옷장이 같은 모양이라 함께 쓴다.
// 첫 진입 안내가 이 버튼들도 가리키므로 그려진 자리를 창 기준으로 재서 올려 보낸다 — 씬 좌표가 없는 화면 레이어라 계산으로는 못 구한다.
function RoomActionButton({ icon, label, hint, iconClassName, route, guideId, onMeasure }: RoomActionButtonProps) {
  const router = useRouter();
  const ref = React.useRef<View>(null);
  const measure = React.useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => onMeasure(guideId, { x, y, width, height }));
  }, [guideId, onMeasure]);

  return (
    <Pressable
      ref={ref}
      onLayout={measure}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={8}
      className="h-10 w-10 items-center justify-center rounded-full bg-accent shadow shadow-black/10 active:opacity-70 dark:border dark:border-border dark:shadow-none"
      onPress={() => router.push(route)}
    >
      <Icon as={icon} size={20} className={iconClassName} />
    </Pressable>
  );
}

// 누르면 알림함(PAGE-28)으로 간다.
function NotificationButton({ onMeasure }: { onMeasure: (id: GuideTargetId, rect: SceneRect) => void }) {
  return (
    <RoomActionButton
      icon={Bell}
      label="알림"
      hint="알림함을 엽니다"
      iconClassName="text-info"
      route={NOTIFICATION_ROUTE}
      guideId="notification"
      onMeasure={onMeasure}
    />
  );
}

/** 잰 자리가 그대로면 상태를 두어 무한 갱신을 막는다 */
function sameRect(left: SceneRect | undefined, right: SceneRect): boolean {
  return left !== undefined && left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

export { HomeScreen };
