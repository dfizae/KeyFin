import * as React from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, runOnJS, SlideInDown, SlideOutDown } from "react-native-reanimated";

/** 뒤 화면이 어두워지는(밝아지는) 시간과 시트가 오르내리는 시간 (2026-09-16 사용자 요청) */
const SCRIM_MS = 220;
const SHEET_MS = 280;
const SCRIM_FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** 스크림(어두운 영역)을 눌러 닫을 때의 접근성 라벨 — "예산 보드 닫기" 처럼 무엇을 닫는지 적는다 */
  closeLabel: string;
  /** 시트 최대 높이(픽셀). 없으면 내용 높이 */
  maxHeight?: number;
  children: React.ReactNode;
};

/**
 * 아래서 올라오는 시트. RN Modal 위에 스크림과 시트를 따로 움직인다 —
 * 열릴 때 뒤 화면이 서서히 어두워지며 시트만 올라오고, 닫힐 때는 반대로 시트가 내려가며 밝아진다.
 * RN Modal 은 `visible` 이 꺼지면 바로 사라져 닫힘 애니메이션이 안 보이므로, 시트가 다 내려간 뒤에 모달을 내린다.
 * 홈 예산 시트·세분류 시트·거래 필터 선택창이 쓴다 (DESIGN.md 인벤토리 BottomSheet).
 */
function BottomSheet({ visible, onClose, closeLabel, maxHeight, children }: BottomSheetProps) {
  // 모달은 시트가 다 내려간 뒤에 내린다. visible 이 바뀐 순간을 렌더 중에 잡아 두는 패턴(이전 렌더 값 기억)이라 effect 가 없다.
  const [lag, setLag] = React.useState({ mounted: visible, seenVisible: visible });
  if (lag.seenVisible !== visible) {
    setLag({ mounted: visible || lag.mounted, seenVisible: visible });
  }
  const mounted = visible || lag.mounted;

  // 내려가는 동안 다시 열렸으면(seenVisible 이 참) 모달을 내리지 않는다
  const finishClose = React.useCallback(() => setLag((state) => (state.seenVisible ? state : { ...state, mounted: false })), []);
  const sheetExit = SlideOutDown.duration(SHEET_MS).withCallback((finished) => {
    "worklet";
    if (finished) runOnJS(finishClose)();
  });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        {visible ? (
          <Animated.View entering={FadeIn.duration(SCRIM_MS)} exiting={FadeOut.duration(SCRIM_MS)} style={SCRIM_FILL}>
            <Pressable className="flex-1 bg-black/50" accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} />
          </Animated.View>
        ) : null}
        {visible ? (
          <Animated.View entering={SlideInDown.duration(SHEET_MS)} exiting={sheetExit}>
            <View className="rounded-t-xl bg-popover pb-8" style={maxHeight === undefined ? undefined : { maxHeight }}>
              {children}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

export { BottomSheet };
export type { BottomSheetProps };
